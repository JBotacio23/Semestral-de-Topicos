-- HU-02: cierra dos huecos de integridad en la carga de documentos (la anon
-- key es pública, así que todo lo que RLS permita se puede hacer saltándose
-- las API routes):
--   1. El usuario podía insertar filas en `documentos` por PostgREST con un
--      storage_path inventado y enviar la solicitud sin subir ningún archivo.
--   2. El bucket no tenía límites: por la API de Storage se podía subir
--      cualquier tipo de archivo, de cualquier tamaño, a la carpeta propia.
-- Solución: el archivo y su fila los escribe solo el servidor (service_role,
-- después de validar en lib/services/documentoService.ts), el bucket impone
-- MIME y tamaño, y enviar_solicitud exige que el objeto exista en Storage.

-- ---------------------------------------------------------------------------
-- Bucket: mismos límites que TIPOS_MIME_PERMITIDOS / TAMANO_MAX_BYTES
-- (lib/validation/solicitud.ts)
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
where id = 'documentos-solicitud';

-- ---------------------------------------------------------------------------
-- Sin escritura directa del usuario en Storage ni en `documentos`
-- (la lectura de lo propio se mantiene: storage_documentos_select_propios y
-- documentos_select_propios de 0002)
-- ---------------------------------------------------------------------------
drop policy "storage_documentos_insert_propios" on storage.objects;

drop policy "documentos_insert_propios" on documentos;
revoke insert on documentos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- enviar_solicitud: cada tipo obligatorio necesita un documento no rechazado
-- cuyo archivo exista de verdad en Storage.
-- Cuando exista la Edge Function de verificación (MR 4) se endurece a
-- estado_verificacion = 'aprobado'.
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

  -- Mantener sincronizado con TIPOS_DOCUMENTO_REQUERIDOS (lib/validation/solicitud.ts)
  select count(*) into v_faltantes
  from unnest(array[
    'identificacion_armador', 'certificado_nave', 'poder_autorizacion'
  ]::tipo_documento[]) as req(tipo)
  where not exists (
    select 1
    from documentos d
    join storage.objects o
      on o.bucket_id = 'documentos-solicitud' and o.name = d.storage_path
    where d.solicitud_id = v_solicitud.id
      and d.tipo_documento = req.tipo
      and d.estado_verificacion <> 'rechazado'
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

-- create or replace conserva los privilegios; se repiten por claridad
revoke execute on function enviar_solicitud(text) from public, anon;
grant execute on function enviar_solicitud(text) to authenticated;
