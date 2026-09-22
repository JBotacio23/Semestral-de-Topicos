-- Esquema inicial: HU-01 (crear solicitud) y HU-02 (cargar documentos)
-- Ver docs/05-modelo-datos.md para el diseño completo del proyecto.

create type rol_usuario as enum ('naviera_armador', 'funcionario_amp', 'aseguradora');

create type estado_solicitud as enum (
  'borrador', 'recibida', 'en_revision', 'requiere_correccion', 'aprobada', 'rechazada'
);

create type estado_verificacion_documento as enum ('pendiente', 'aprobado', 'rechazado');

create type tipo_documento as enum (
  'identificacion_armador', 'certificado_nave', 'poder_autorizacion', 'otro'
);

-- ---------------------------------------------------------------------------
-- usuarios (extiende auth.users 1:1)
-- ---------------------------------------------------------------------------
create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null default 'naviera_armador',
  organizacion text,
  creado_en timestamptz not null default now()
);

-- Crea automáticamente la fila en `usuarios` cuando alguien se registra
-- en Supabase Auth. Todo el que se registra por el portal público es
-- naviera_armador; el rol funcionario_amp se asigna manualmente (ver docs/04).
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email),
    'naviera_armador'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- naves
-- ---------------------------------------------------------------------------
create table naves (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  numero_omi text,
  bandera_actual text not null,
  puerto_registro_actual text,
  armador_id uuid not null references usuarios (id),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- solicitudes
-- ---------------------------------------------------------------------------
create sequence solicitudes_numero_tramite_seq;

create table solicitudes (
  id uuid primary key default gen_random_uuid(),
  numero_tramite text unique,
  nave_id uuid not null references naves (id),
  solicitante_id uuid not null references usuarios (id),
  nombre_armador text not null,
  identificacion_armador text not null,
  email_contacto text not null,
  telefono_contacto text not null,
  estado estado_solicitud not null default 'recibida',
  funcionario_id uuid references usuarios (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create function generar_numero_tramite()
returns trigger
language plpgsql
as $$
begin
  new.numero_tramite := 'AMP-' || extract(year from now())::text || '-' ||
    lpad(nextval('solicitudes_numero_tramite_seq')::text, 6, '0');
  return new;
end;
$$;

create trigger before_insert_solicitud
  before insert on solicitudes
  for each row execute procedure generar_numero_tramite();

create index idx_solicitudes_solicitante on solicitudes (solicitante_id, estado);
create index idx_solicitudes_numero_tramite on solicitudes (numero_tramite);

-- ---------------------------------------------------------------------------
-- documentos
-- ---------------------------------------------------------------------------
create table documentos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes (id) on delete cascade,
  tipo_documento tipo_documento not null,
  storage_path text not null,
  nombre_original text not null,
  mime text not null,
  tamano_bytes bigint not null,
  estado_verificacion estado_verificacion_documento not null default 'pendiente',
  motivo_rechazo text,
  creado_en timestamptz not null default now()
);

create index idx_documentos_solicitud on documentos (solicitud_id);

-- ---------------------------------------------------------------------------
-- historial_estados (bitácora inmutable, alimenta HU-06 más adelante)
-- ---------------------------------------------------------------------------
create table historial_estados (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes (id) on delete cascade,
  estado_anterior estado_solicitud,
  estado_nuevo estado_solicitud not null,
  comentario text,
  cambiado_por uuid references usuarios (id),
  creado_en timestamptz not null default now()
);

create index idx_historial_solicitud on historial_estados (solicitud_id, creado_en);

-- Mantiene actualizado_en al día en cada cambio
create function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger before_update_solicitud
  before update on solicitudes
  for each row execute procedure tocar_actualizado_en();

-- Bucket privado de Storage para los documentos de las solicitudes
insert into storage.buckets (id, name, public)
values ('documentos-solicitud', 'documentos-solicitud', false)
on conflict (id) do nothing;
