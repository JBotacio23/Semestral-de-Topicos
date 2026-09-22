-- HU-02: pipeline automático de verificación de documentos (CLAUDE.md).
-- Cada fila nueva en `documentos` (el archivo ya está en Storage) invoca la
-- Edge Function verificar-documento vía pg_net. La función marca el documento
-- aprobado/rechazado y llama a avanzar_a_revision, que pasa la solicitud a
-- "en_revision" cuando están aprobados todos los obligatorios.
--
-- Configuración por proyecto (staging y prod), una sola vez, en Vault:
--   select vault.create_secret('https://<ref>.supabase.co', 'verificacion_project_url');
--   select vault.create_secret('<secreto largo>', 'verificacion_webhook_secret');
-- El mismo secreto va como WEBHOOK_SECRET en los secrets de la Edge Function.
-- Sin estos secretos la carga sigue funcionando y el documento queda "pendiente".

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Regla única de "trámite completo": cada tipo obligatorio con un documento
-- aprobado cuyo archivo existe en Storage.
-- Mantener sincronizado con TIPOS_DOCUMENTO_REQUERIDOS (lib/validation/solicitud.ts)
-- ---------------------------------------------------------------------------
create function contar_documentos_faltantes(p_solicitud_id uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from unnest(array[
    'identificacion_armador', 'certificado_nave', 'poder_autorizacion'
  ]::tipo_documento[]) as req(tipo)
  where not exists (
    select 1
    from documentos d
    join storage.objects o
      on o.bucket_id = 'documentos-solicitud' and o.name = d.storage_path
    where d.solicitud_id = p_solicitud_id
      and d.tipo_documento = req.tipo
      and d.estado_verificacion = 'aprobado'
  );
$$;

revoke execute on function contar_documentos_faltantes(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Etapa 5: paso automático a "en_revision". Solo la invoca la Edge Function
-- (service_role). Idempotente: devuelve false si no corresponde avanzar.
-- ---------------------------------------------------------------------------
create function avanzar_a_revision(p_solicitud_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado estado_solicitud;
begin
  select estado into v_estado from solicitudes where id = p_solicitud_id for update;

  if not found or v_estado <> 'recibida' then
    return false;
  end if;

  if contar_documentos_faltantes(p_solicitud_id) > 0 then
    return false;
  end if;

  update solicitudes set estado = 'en_revision' where id = p_solicitud_id;

  insert into historial_estados (solicitud_id, estado_anterior, estado_nuevo, comentario, cambiado_por)
  values (p_solicitud_id, 'recibida', 'en_revision', 'Documentación verificada automáticamente', null);

  return true;
end;
$$;

revoke execute on function avanzar_a_revision(uuid) from public, anon, authenticated;
grant execute on function avanzar_a_revision(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- enviar_solicitud (respaldo manual): ahora exige los obligatorios aprobados,
-- con la misma regla que el paso automático.
-- ---------------------------------------------------------------------------
create or replace function enviar_solicitud(p_numero_tramite text)
returns solicitudes
language plpgsql
security definer set search_path = public
as $$
declare
  v_solicitud solicitudes;
  v_faltantes int;
begin
  select * into v_solicitud
  from solicitudes
  where numero_tramite = p_numero_tramite
    and solicitante_id = auth.uid()
  for update;

  if not found then
    raise exception 'No existe una solicitud con ese número de trámite.'
      using errcode = 'AMP04';
  end if;

  if v_solicitud.estado <> 'recibida' then
    raise exception 'La solicitud ya se encuentra en estado "%".', v_solicitud.estado
      using errcode = 'AMP00';
  end if;

  v_faltantes := contar_documentos_faltantes(v_solicitud.id);
  if v_faltantes > 0 then
    raise exception 'No se puede enviar: faltan % documento(s) obligatorio(s) cargados y verificados.', v_faltantes
      using errcode = 'AMP00';
  end if;

  update solicitudes set estado = 'en_revision'
  where id = v_solicitud.id
  returning * into v_solicitud;

  insert into historial_estados (solicitud_id, estado_anterior, estado_nuevo, cambiado_por)
  values (v_solicitud.id, 'recibida', 'en_revision', auth.uid());

  return v_solicitud;
end;
$$;

revoke execute on function enviar_solicitud(text) from public, anon;
grant execute on function enviar_solicitud(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Disparo de la Edge Function (asíncrono: pg_net envía el request después
-- del commit, así que no demora ni revierte la carga del documento).
-- ---------------------------------------------------------------------------
create function solicitar_verificacion(p_documento_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_url text;
  v_secreto text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'verificacion_project_url';
  select decrypted_secret into v_secreto
  from vault.decrypted_secrets where name = 'verificacion_webhook_secret';

  if v_url is null or v_secreto is null then
    raise warning 'Pipeline de verificación sin configurar en Vault: el documento % queda pendiente', p_documento_id;
    return false;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/verificar-documento',
    body := jsonb_build_object('documento_id', p_documento_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto),
    timeout_milliseconds := 90000
  );
  return true;
end;
$$;

revoke execute on function solicitar_verificacion(uuid) from public, anon, authenticated;

create function tg_verificar_documento_nuevo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform solicitar_verificacion(new.id);
  return new;
end;
$$;

revoke execute on function tg_verificar_documento_nuevo() from public, anon, authenticated;

create trigger after_insert_documento_verificar
  after insert on documentos
  for each row execute procedure tg_verificar_documento_nuevo();

-- ---------------------------------------------------------------------------
-- Reintento de documentos que quedaron pendientes (p. ej. ClamAV caído).
-- Se puede programar con pg_cron, ver supabase/scripts/verificar_ajustes_hu01_hu02.sql
-- ---------------------------------------------------------------------------
create function reintentar_verificaciones_pendientes(p_antiguedad interval default interval '5 minutes')
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_doc record;
  v_total int := 0;
begin
  for v_doc in
    select d.id
    from documentos d
    join solicitudes s on s.id = d.solicitud_id
    where d.estado_verificacion = 'pendiente'
      and s.estado = 'recibida'
      and d.creado_en < now() - p_antiguedad
  loop
    if solicitar_verificacion(v_doc.id) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;

revoke execute on function reintentar_verificaciones_pendientes(interval) from public, anon, authenticated;
grant execute on function reintentar_verificaciones_pendientes(interval) to service_role;
