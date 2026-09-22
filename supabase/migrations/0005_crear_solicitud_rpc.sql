-- HU-01: crear la nave, la solicitud y la entrada inicial de la bitácora en
-- una sola transacción. Antes eran tres llamadas separadas desde
-- lib/services/solicitudService.ts: si fallaba la solicitud quedaba una nave
-- huérfana, y el error del insert en historial_estados se ignoraba.
-- El dueño siempre es auth.uid(); nunca se recibe como parámetro.

create function crear_solicitud(
  p_nombre_nave text,
  p_tipo_nave text,
  p_numero_omi text,
  p_bandera_actual text,
  p_puerto_registro_actual text,
  p_nombre_armador text,
  p_identificacion_armador text,
  p_email_contacto text,
  p_telefono_contacto text
)
returns solicitudes
language plpgsql
security definer set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_nave_id uuid;
  v_solicitud solicitudes;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'AMP01';
  end if;

  insert into naves (nombre, tipo, numero_omi, bandera_actual, puerto_registro_actual, armador_id)
  values (
    p_nombre_nave, p_tipo_nave, nullif(p_numero_omi, ''), p_bandera_actual,
    nullif(p_puerto_registro_actual, ''), v_usuario
  )
  returning id into v_nave_id;

  insert into solicitudes (
    nave_id, solicitante_id, nombre_armador, identificacion_armador,
    email_contacto, telefono_contacto
  )
  values (
    v_nave_id, v_usuario, p_nombre_armador, p_identificacion_armador,
    p_email_contacto, p_telefono_contacto
  )
  returning * into v_solicitud;

  insert into historial_estados (solicitud_id, estado_anterior, estado_nuevo, cambiado_por)
  values (v_solicitud.id, null, v_solicitud.estado, v_usuario);

  return v_solicitud;
end;
$$;

revoke execute on function crear_solicitud(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function crear_solicitud(text, text, text, text, text, text, text, text, text) to authenticated;
