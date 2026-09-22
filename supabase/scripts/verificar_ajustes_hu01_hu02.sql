-- ===========================================================================
-- Verificación de las migraciones 0004, 0005 y 0006 (HU-01 / HU-02)
--
-- Cómo usarlo: pegar todo en Supabase → SQL Editor → Run, en cada proyecto
-- (staging y prod) DESPUÉS de aplicar las migraciones. Devuelve una tabla con
-- ✅ / ❌ / ⚠️ por cada prueba.
--
-- No deja datos: las pruebas funcionales corren dentro de un bloque que se
-- revierte al final. Solo consume un número de la secuencia de trámites.
-- Requiere al menos un usuario registrado en la app (rol naviera_armador).
-- ===========================================================================

create temp table if not exists _verificacion (
  n serial,
  prueba text,
  ok boolean,
  detalle text
);
truncate _verificacion restart identity;

-- Privilegio sobre una función, o null si la función no existe
create or replace function pg_temp.puede_ejecutar(p_rol text, p_firma text)
returns boolean language sql as $$
  select case when to_regprocedure(p_firma) is null then null
              else has_function_privilege(p_rol, p_firma, 'EXECUTE') end
$$;

-- ---------------------------------------------------------------------------
-- 0004 — integridad de documentos
-- ---------------------------------------------------------------------------
insert into _verificacion (prueba, ok, detalle)
select '0004 · Bucket limitado a 5 MB',
       b.file_size_limit = 5242880,
       coalesce(b.file_size_limit::text, 'sin límite')
from storage.buckets b where b.id = 'documentos-solicitud';

insert into _verificacion (prueba, ok, detalle)
select '0004 · Bucket solo acepta PDF/PNG/JPG',
       b.allowed_mime_types @> array['application/pdf', 'image/png', 'image/jpeg']
         and array_length(b.allowed_mime_types, 1) = 3,
       coalesce(array_to_string(b.allowed_mime_types, ', '), 'sin restricción')
from storage.buckets b where b.id = 'documentos-solicitud';

insert into _verificacion (prueba, ok, detalle) values
  ('0004 · Sin política de INSERT del usuario en Storage',
   not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
               and policyname = 'storage_documentos_insert_propios'),
   null),
  ('0004 · Sin política de INSERT del usuario en documentos',
   not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos'
               and policyname = 'documentos_insert_propios'),
   null),
  ('0004 · authenticated no puede insertar en documentos (ni por columna)',
   not has_any_column_privilege('authenticated', 'public.documentos', 'INSERT'),
   null),
  ('0004 · anon no puede insertar en documentos',
   not has_any_column_privilege('anon', 'public.documentos', 'INSERT'),
   null);

-- ---------------------------------------------------------------------------
-- 0005 — crear_solicitud atómico
-- ---------------------------------------------------------------------------
insert into _verificacion (prueba, ok, detalle) values
  ('0005 · crear_solicitud existe y authenticated la puede ejecutar',
   pg_temp.puede_ejecutar('authenticated', 'public.crear_solicitud(text,text,text,text,text,text,text,text,text)'),
   null),
  ('0005 · anon NO puede ejecutar crear_solicitud',
   not pg_temp.puede_ejecutar('anon', 'public.crear_solicitud(text,text,text,text,text,text,text,text,text)'),
   null);

-- ---------------------------------------------------------------------------
-- 0006 — pipeline de verificación
-- ---------------------------------------------------------------------------
insert into _verificacion (prueba, ok, detalle) values
  ('0006 · Extensión pg_net instalada',
   exists (select 1 from pg_extension where extname = 'pg_net'),
   null),
  ('0006 · Trigger que dispara la verificación al cargar un documento',
   exists (select 1 from pg_trigger where tgname = 'after_insert_documento_verificar'
           and tgrelid = 'public.documentos'::regclass),
   null),
  ('0006 · avanzar_a_revision: solo service_role',
   pg_temp.puede_ejecutar('service_role', 'public.avanzar_a_revision(uuid)')
     and not pg_temp.puede_ejecutar('authenticated', 'public.avanzar_a_revision(uuid)')
     and not pg_temp.puede_ejecutar('anon', 'public.avanzar_a_revision(uuid)'),
   null),
  ('0006 · contar_documentos_faltantes no expuesta a usuarios',
   not pg_temp.puede_ejecutar('authenticated', 'public.contar_documentos_faltantes(uuid)')
     and not pg_temp.puede_ejecutar('anon', 'public.contar_documentos_faltantes(uuid)'),
   null),
  ('0006 · solicitar_verificacion no expuesta a usuarios',
   not pg_temp.puede_ejecutar('authenticated', 'public.solicitar_verificacion(uuid)')
     and not pg_temp.puede_ejecutar('anon', 'public.solicitar_verificacion(uuid)'),
   null),
  ('0006 · enviar_solicitud exige documentos aprobados',
   exists (select 1 from pg_proc where proname = 'enviar_solicitud'
           and prosrc ilike '%contar_documentos_faltantes%'),
   null);

-- Configuración (no es falla de la migración: ⚠️ si falta)
insert into _verificacion (prueba, ok, detalle)
select 'Config · Secrets de Vault para invocar la Edge Function',
       case when count(*) = 2 then true else null end,
       case when count(*) = 2 then 'verificacion_project_url y verificacion_webhook_secret presentes'
            else 'Faltan: ejecutar vault.create_secret (ver migración 0006). Sin esto los documentos quedan "pendiente".' end
from vault.secrets
where name in ('verificacion_project_url', 'verificacion_webhook_secret');

-- ---------------------------------------------------------------------------
-- Pruebas funcionales como un usuario real (se revierten al final)
-- ---------------------------------------------------------------------------
do $$
declare
  v_usuario uuid;
  v_sol public.solicitudes;
  v_historial int;
  v_naves int;
  -- resultados: [ok, detalle]
  r_crear boolean;          d_crear text;
  r_historial boolean;      d_historial text;
  r_anon boolean;           d_anon text;
  r_doc_directo boolean;    d_doc_directo text;
  r_storage boolean;        d_storage text;
  r_enviar boolean;         d_enviar text;
  r_avanzar_auth boolean;   d_avanzar_auth text;
  r_avanzar boolean;        d_avanzar text;
  v_error text;
begin
  select id into v_usuario from public.usuarios where rol = 'naviera_armador' limit 1;
  if v_usuario is null then
    insert into _verificacion (prueba, ok, detalle)
    values ('Funcional · (omitidas)', null, 'No hay usuarios naviera_armador: regístrate en la app y vuelve a correr el script.');
    return;
  end if;

  begin
    -- Simula una request de PostgREST con la sesión de ese usuario
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- HU-01: crear_solicitud crea nave + solicitud + bitácora
    v_sol := public.crear_solicitud('Nave Prueba Verificación', 'Carga', null, 'Panamá', null,
                                    'Armador Prueba', '8-000-000', 'prueba@example.com', '6000-0000');
    r_crear := v_sol.numero_tramite is not null and v_sol.estado = 'recibida'
               and v_sol.solicitante_id = v_usuario;
    d_crear := format('trámite %s, estado %s', v_sol.numero_tramite, v_sol.estado);

    select count(*) into v_historial from public.historial_estados where solicitud_id = v_sol.id;
    select count(*) into v_naves from public.naves where id = v_sol.nave_id and armador_id = v_usuario;
    r_historial := v_historial = 1 and v_naves = 1;
    d_historial := format('%s entrada(s) de bitácora, %s nave', v_historial, v_naves);

    -- HU-02: insertar un documento "fantasma" por PostgREST debe fallar
    begin
      insert into public.documentos (solicitud_id, tipo_documento, storage_path, nombre_original, mime, tamano_bytes)
      values (v_sol.id, 'certificado_nave', v_sol.id || '/falso.pdf', 'falso.pdf', 'application/pdf', 10);
      r_doc_directo := false; d_doc_directo := 'el INSERT se permitió';
    exception when others then
      r_doc_directo := sqlstate = '42501'; d_doc_directo := sqlerrm;
    end;

    -- HU-02: subir directo a Storage (lo que haría la API de Storage) debe fallar
    begin
      insert into storage.objects (bucket_id, name, owner)
      values ('documentos-solicitud', v_sol.id || '/malware.exe', v_usuario);
      r_storage := false; d_storage := 'el INSERT en storage.objects se permitió';
    exception when others then
      r_storage := sqlstate = '42501'; d_storage := sqlerrm;
    end;

    -- HU-02: enviar sin documentos aprobados debe fallar
    begin
      perform public.enviar_solicitud(v_sol.numero_tramite);
      r_enviar := false; d_enviar := 'se envió sin documentos';
    exception when others then
      r_enviar := sqlerrm ilike '%No se puede enviar%'; d_enviar := sqlerrm;
    end;

    -- El usuario no puede forzar el paso automático
    begin
      perform public.avanzar_a_revision(v_sol.id);
      r_avanzar_auth := false; d_avanzar_auth := 'authenticated pudo ejecutarla';
    exception when others then
      r_avanzar_auth := sqlstate = '42501'; d_avanzar_auth := sqlerrm;
    end;

    -- Como sistema: sin documentos aprobados no debe avanzar
    reset role;
    r_avanzar := public.avanzar_a_revision(v_sol.id) = false;
    d_avanzar := 'devuelve false sin documentos aprobados';

    -- anon no puede crear solicitudes
    set local role anon;
    begin
      perform public.crear_solicitud('x', 'x', null, 'x', null, 'x', 'x', 'x@x.com', 'x');
      r_anon := false; d_anon := 'anon pudo crear una solicitud';
    exception when others then
      r_anon := sqlstate = '42501'; d_anon := sqlerrm;
    end;

    raise exception '__revertir_pruebas__';
  exception when others then
    if sqlerrm <> '__revertir_pruebas__' then
      v_error := sqlerrm;
    end if;
  end;

  if v_error is not null then
    insert into _verificacion (prueba, ok, detalle)
    values ('Funcional · error inesperado', false, v_error);
  end if;

  insert into _verificacion (prueba, ok, detalle) values
    ('Funcional · HU-01 crear_solicitud crea la solicitud', r_crear, d_crear),
    ('Funcional · HU-01 nave + bitácora en la misma transacción', r_historial, d_historial),
    ('Funcional · HU-01 anon no puede crear solicitudes', r_anon, d_anon),
    ('Funcional · HU-02 documento fantasma por PostgREST bloqueado', r_doc_directo, d_doc_directo),
    ('Funcional · HU-02 subida directa a Storage bloqueada', r_storage, d_storage),
    ('Funcional · HU-02 enviar sin documentos aprobados falla', r_enviar, d_enviar),
    ('Funcional · HU-02 usuario no puede forzar avanzar_a_revision', r_avanzar_auth, d_avanzar_auth),
    ('Funcional · HU-02 avanzar_a_revision no avanza sin documentos', r_avanzar, d_avanzar);
end;
$$;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------
select case ok when true then '✅' when false then '❌' else '⚠️' end as resultado,
       prueba,
       detalle
from _verificacion
order by n;

-- ---------------------------------------------------------------------------
-- Opcional: reintentar cada 5 min los documentos que quedaron "pendiente"
-- (p. ej. si ClamAV estuvo caído). Requiere la extensión pg_cron.
-- ---------------------------------------------------------------------------
-- select cron.schedule('reintentar-verificaciones', '*/5 * * * *',
--                      $$ select public.reintentar_verificaciones_pendientes() $$);
