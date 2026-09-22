import type { SupabaseClient } from "@supabase/supabase-js";
import { TIPOS_DOCUMENTO_REQUERIDOS, type CrearSolicitudInput } from "@/lib/validation/solicitud";
import { enviarConfirmacionSolicitud } from "@/lib/services/notificacionService";

export class ServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * HU-01 — crea la nave, la solicitud y la entrada inicial de la bitácora para
 * el usuario autenticado, en una sola transacción (función `crear_solicitud`,
 * supabase/migrations/0005_crear_solicitud_rpc.sql). `db` es el cliente con
 * sesión del usuario: el dueño lo fija la BD con auth.uid().
 */
export async function crearSolicitud(db: SupabaseClient, input: CrearSolicitudInput) {
  const { data: solicitud, error } = await db.rpc("crear_solicitud", {
    p_nombre_nave: input.nombre_nave,
    p_tipo_nave: input.tipo_nave,
    p_numero_omi: input.numero_omi ?? null,
    p_bandera_actual: input.bandera_actual,
    p_puerto_registro_actual: input.puerto_registro_actual ?? null,
    p_nombre_armador: input.nombre_armador,
    p_identificacion_armador: input.identificacion_armador,
    p_email_contacto: input.email_contacto,
    p_telefono_contacto: input.telefono_contacto,
  });

  if (error) throw new ServiceError(error.message, error.code === "AMP01" ? 401 : 400);

  // Criterio de aceptación de HU-01. Si el correo falla, la solicitud ya
  // quedó creada: se registra en el log y el número se muestra en pantalla.
  await enviarConfirmacionSolicitud(solicitud.email_contacto, solicitud.numero_tramite);

  return solicitud;
}

/** HU-01/02 — consulta una solicitud propia junto con sus documentos. */
export async function obtenerSolicitudPorTramite(db: SupabaseClient, numeroTramite: string) {
  const { data: solicitud, error } = await db
    .from("solicitudes")
    .select("*, naves(*)")
    .eq("numero_tramite", numeroTramite)
    .maybeSingle();

  if (error) throw new ServiceError(error.message, 400);
  if (!solicitud) throw new ServiceError("No existe una solicitud con ese número de trámite.", 404);

  const { data: documentos, error: errorDocs } = await db
    .from("documentos")
    .select("id, tipo_documento, nombre_original, mime, tamano_bytes, estado_verificacion, motivo_rechazo, creado_en")
    .eq("solicitud_id", solicitud.id)
    .order("creado_en");

  if (errorDocs) throw new ServiceError(errorDocs.message, 400);

  // Un documento rechazado por el pipeline de verificación no cuenta: hay que volver a cargarlo.
  const presentes = new Set(
    (documentos ?? []).filter((d) => d.estado_verificacion !== "rechazado").map((d) => d.tipo_documento)
  );
  const faltantes = TIPOS_DOCUMENTO_REQUERIDOS.filter((t) => !presentes.has(t));

  return {
    solicitud,
    documentos: documentos ?? [],
    tipos_documento_requeridos: TIPOS_DOCUMENTO_REQUERIDOS,
    tipos_documento_faltantes: faltantes,
    lista_para_enviar: faltantes.length === 0,
  };
}

/**
 * HU-02 — respaldo manual e idempotente: normalmente la solicitud pasa sola a
 * "en_revision" cuando la Edge Function verificar-documento aprueba el último
 * documento obligatorio. Exige los obligatorios en estado "aprobado".
 * El usuario no tiene privilegio UPDATE sobre `estado`: la transición y la
 * bitácora las hace la función `enviar_solicitud` en una sola transacción
 * (supabase/migrations/0003_restringir_columnas_y_enviar.sql).
 */
export async function enviarSolicitud(db: SupabaseClient, numeroTramite: string) {
  const { data: actualizada, error } = await db.rpc("enviar_solicitud", {
    p_numero_tramite: numeroTramite,
  });

  if (error) throw new ServiceError(error.message, error.code === "AMP04" ? 404 : 400);

  // TODO: notificar al solicitante (correo) del cambio de estado (HU-06).

  return actualizada;
}
