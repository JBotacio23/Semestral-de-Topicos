-- Corrige dos escaladas de privilegios de 0002 (las políticas RLS filtran
-- filas, no columnas, y la anon key es pública: cualquiera puede llamar a
-- PostgREST directamente):
--   1. usuarios_update_propio permitía cambiar `rol` (p. ej. a funcionario_amp).
--   2. solicitudes_update_propias_mientras_recibida permitía cambiar `estado`
--      (p. ej. a 'aprobada'), `funcionario_id` o `numero_tramite`.
-- Solución: privilegios por columna para `authenticated`/`anon`, y el cambio
-- de estado de HU-02 pasa a una función `security definer` que valida la
-- transición. `service_role` conserva sus privilegios completos.

-- ---------------------------------------------------------------------------
-- usuarios: solo datos no sensibles (ver docs/04-matriz-permisos.md)
-- ---------------------------------------------------------------------------
revoke insert, update on usuarios from anon, authenticated;
grant update (nombre, organizacion) on usuarios to authenticated;

drop policy "usuarios_update_propio" on usuarios;
create policy "usuarios_update_propio" on usuarios
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- solicitudes: el solicitante solo escribe datos de contacto; `estado`,
-- `funcionario_id` y `numero_tramite` los controla el sistema
-- ---------------------------------------------------------------------------
revoke insert, update on solicitudes from anon, authenticated;
grant insert (
  nave_id, solicitante_id, nombre_armador, identificacion_armador,
  email_contacto, telefono_contacto
) on solicitudes to authenticated;
grant update (
  nombre_armador, identificacion_armador, email_contacto, telefono_contacto
) on solicitudes to authenticated;

-- ---------------------------------------------------------------------------
-- documentos: el usuario no puede autoaprobar `estado_verificacion` ni
-- escribir `motivo_rechazo` (los escribe el pipeline / funcionario AMP)
-- ---------------------------------------------------------------------------
revoke insert, update on documentos from anon, authenticated;
grant insert (
  solicitud_id, tipo_documento, storage_path, nombre_original, mime, tamano_bytes
) on documentos to authenticated;

-- ---------------------------------------------------------------------------
-- HU-02: recibida -> en_revision, atómico y validado en la BD
-- ---------------------------------------------------------------------------
create function enviar_solicitud(p_numero_tramite text)
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

  -- Mantener sincronizado con TIPOS_DOCUMENTO_REQUERIDOS (lib/validation/solicitud.ts)
  select count(*) into v_faltantes
  from unnest(array[
    'identificacion_armador', 'certificado_nave', 'poder_autorizacion'
  ]::tipo_documento[]) as req(tipo)
  where not exists (
    select 1 from documentos d
    where d.solicitud_id = v_solicitud.id and d.tipo_documento = req.tipo
  );

  if v_faltantes > 0 then
    raise exception 'No se puede enviar: falta adjuntar % documento(s) obligatorio(s).', v_faltantes
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
