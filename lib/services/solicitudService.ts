import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIPOS_DOCUMENTO_REQUERIDOS, type CrearSolicitudInput } from "@/lib/validation/solicitud";

export class ServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * HU-01 — crea la nave y la solicitud de registro para el usuario autenticado.
 * `db` es el cliente con sesión del usuario: los inserts pasan por RLS,
 * así que solo puede crear solicitudes a su propio nombre (naves.armador_id,
 * solicitudes.solicitante_id = auth.uid()).
 */
export async function crearSolicitud(db: SupabaseClient, userId: string, input: CrearSolicitudInput) {
  const { data: nave, error: errorNave } = await db
    .from("naves")
    .insert({
      nombre: input.nombre_nave,
      tipo: input.tipo_nave,
      numero_omi: input.numero_omi ?? null,
      bandera_actual: input.bandera_actual,
      puerto_registro_actual: input.puerto_registro_actual ?? null,
      armador_id: userId,
    })
    .select()
    .single();

  if (errorNave) throw new ServiceError(errorNave.message, 400);

  const { data: solicitud, error: errorSolicitud } = await db
    .from("solicitudes")
    .insert({
      nave_id: nave.id,
      solicitante_id: userId,
      nombre_armador: input.nombre_armador,
      identificacion_armador: input.identificacion_armador,
      email_contacto: input.email_contacto,
      telefono_contacto: input.telefono_contacto,
    })
    .select()
    .single();

  if (errorSolicitud) throw new ServiceError(errorSolicitud.message, 400);

  // Bitácora de creación (estado inicial). Se escribe con el cliente admin
  // porque historial_estados no admite INSERT desde el usuario (ver RLS).
  const admin = createAdminClient();
  await admin.from("historial_estados").insert({
    solicitud_id: solicitud.id,
    estado_anterior: null,
    estado_nuevo: "recibida",
    cambiado_por: userId,
  });

  // TODO: enviar correo de confirmación con el número de trámite (criterio
  // de aceptación de HU-01). Pendiente: conectar Resend (RESEND_API_KEY ya
  // está en .env) o Supabase Auth email hooks. Ver docs/02-entornos.md.

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
    .select("id, tipo_documento, nombre_original, mime, tamano_bytes, estado_verificacion, creado_en")
    .eq("solicitud_id", solicitud.id)
    .order("creado_en");

  if (errorDocs) throw new ServiceError(errorDocs.message, 400);

  const presentes = new Set((documentos ?? []).map((d) => d.tipo_documento));
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
 * HU-02 — pasa la solicitud a "en_revision" si ya tiene los documentos obligatorios.
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
