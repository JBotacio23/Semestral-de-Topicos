import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceError } from "@/lib/services/solicitudService";
import { TAMANO_MAX_BYTES, TIPOS_MIME_PERMITIDOS } from "@/lib/validation/solicitud";
import { BYTES_FIRMA, detectarMime, EXTENSION_POR_MIME } from "@/lib/validation/archivo";

const BUCKET = "documentos-solicitud";

/**
 * HU-02 — sube un documento de la solicitud a Supabase Storage y registra
 * la fila en `documentos`. Implementa las etapas 2 (formato real/tamaño) y 4
 * (validación de tipo de documento) del pipeline descrito en CLAUDE.md.
 *
 * El llamador debe haber verificado antes, con el cliente del usuario (RLS),
 * que la solicitud es suya y sigue en estado "recibida": aquí se escribe con
 * el cliente admin porque el usuario no tiene INSERT sobre Storage ni sobre
 * `documentos` (supabase/migrations/0004_documentos_integridad.sql).
 *
 * Pendiente (no implementado aún): etapa 3, escaneo antimalware. Se agrega
 * como Edge Function que actualice `estado_verificacion`; ver docs/06-ci-cd.md.
 */
export async function subirDocumento(solicitudId: string, tipoDocumento: string, archivo: File) {
  if (!TIPOS_MIME_PERMITIDOS.includes(archivo.type)) {
    throw new ServiceError("Tipo de archivo no permitido. Solo se aceptan PDF, PNG o JPG.", 400);
  }
  if (archivo.size > TAMANO_MAX_BYTES) {
    throw new ServiceError("El archivo supera el tamaño máximo permitido de 5 MB.", 400);
  }

  const cabecera = new Uint8Array(await archivo.slice(0, BYTES_FIRMA).arrayBuffer());
  if (detectarMime(cabecera) !== archivo.type) {
    throw new ServiceError(
      "El contenido del archivo no corresponde a un PDF, PNG o JPG válido.",
      400
    );
  }

  const nombreArchivo = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${EXTENSION_POR_MIME[archivo.type]}`;
  const storagePath = `${solicitudId}/${nombreArchivo}`;

  const admin = createAdminClient();

  const { error: errorStorage } = await admin.storage.from(BUCKET).upload(storagePath, archivo, {
    contentType: archivo.type,
    upsert: false,
  });
  if (errorStorage) throw new ServiceError(errorStorage.message, 400);

  const { data: documento, error } = await admin
    .from("documentos")
    .insert({
      solicitud_id: solicitudId,
      tipo_documento: tipoDocumento,
      storage_path: storagePath,
      nombre_original: archivo.name,
      mime: archivo.type,
      tamano_bytes: archivo.size,
    })
    .select("id, tipo_documento, nombre_original, mime, tamano_bytes, estado_verificacion, creado_en")
    .single();

  if (error) {
    // Revierte la subida si no se pudo registrar la fila (evita huérfanos).
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new ServiceError(error.message, 400);
  }

  return documento;
}
