-- Políticas RLS para HU-01 y HU-02 (rol naviera_armador).
-- Ver docs/04-matriz-permisos.md. Se amplían en sprints siguientes cuando
-- se agreguen los roles funcionario_amp y aseguradora.

alter table usuarios enable row level security;
alter table naves enable row level security;
alter table solicitudes enable row level security;
alter table documentos enable row level security;
alter table historial_estados enable row level security;

-- usuarios: cada quien ve y edita su propia fila
create policy "usuarios_select_propio" on usuarios
  for select using (id = auth.uid());

create policy "usuarios_update_propio" on usuarios
  for update using (id = auth.uid());

-- naves: el armador dueño ve y crea sus propias naves
create policy "naves_select_propias" on naves
  for select using (armador_id = auth.uid());

create policy "naves_insert_propias" on naves
  for insert with check (armador_id = auth.uid());

-- solicitudes: el solicitante ve y crea las suyas; puede editarlas mientras
-- siguen en estado 'recibida' (antes de que la revise un funcionario)
create policy "solicitudes_select_propias" on solicitudes
  for select using (solicitante_id = auth.uid());

create policy "solicitudes_insert_propias" on solicitudes
  for insert with check (solicitante_id = auth.uid());

create policy "solicitudes_update_propias_mientras_recibida" on solicitudes
  for update
  using (solicitante_id = auth.uid() and estado = 'recibida')
  with check (solicitante_id = auth.uid());

-- documentos: visibles y cargables solo por el dueño de la solicitud,
-- y solo mientras la solicitud no fue enviada a revisión
create policy "documentos_select_propios" on documentos
  for select using (
    exists (
      select 1 from solicitudes s
      where s.id = documentos.solicitud_id and s.solicitante_id = auth.uid()
    )
  );

create policy "documentos_insert_propios" on documentos
  for insert with check (
    exists (
      select 1 from solicitudes s
      where s.id = documentos.solicitud_id
        and s.solicitante_id = auth.uid()
        and s.estado = 'recibida'
    )
  );

-- historial_estados: solo lectura para quien puede ver la solicitud;
-- lo escribe únicamente el Service con el cliente admin (service_role)
create policy "historial_select_propio" on historial_estados
  for select using (
    exists (
      select 1 from solicitudes s
      where s.id = historial_estados.solicitud_id and s.solicitante_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket documentos-solicitud
-- Ruta esperada de cada objeto: "<solicitud_id>/<archivo>"
-- ---------------------------------------------------------------------------
create policy "storage_documentos_select_propios" on storage.objects
  for select using (
    bucket_id = 'documentos-solicitud'
    and exists (
      select 1 from solicitudes s
      where s.id::text = (storage.foldername(name))[1]
        and s.solicitante_id = auth.uid()
    )
  );

create policy "storage_documentos_insert_propios" on storage.objects
  for insert with check (
    bucket_id = 'documentos-solicitud'
    and exists (
      select 1 from solicitudes s
      where s.id::text = (storage.foldername(name))[1]
        and s.solicitante_id = auth.uid()
        and s.estado = 'recibida'
    )
  );
