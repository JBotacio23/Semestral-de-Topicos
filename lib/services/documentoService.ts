import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/lib/services/solicitudService";
import { TAMANO_MAX_BYTES, TIPOS_MIME_PERMITIDOS } from "@/lib/validation/solicitud";

const BUCKET = "documentos-solicitud";

/**
 * HU-02 — sube un documento de la solicitud a Supabase Storage y registra
 * la fila en `documentos`. Implementa las etapas 2 (formato/tamaño) y 4
 * (validación de tipo de documento) del pipeline descrito en CLAUDE.md.
 *
 * Pendiente (no implementado aún): etapa 3, escaneo antimalware. Se agrega
 * como función separada (Lambda o Edge Function) que actualice
 * `estado_verificacion`; ver docs/06-ci-cd.md.
 */
export async function subirDocumento(
  db: SupabaseClient,
  solicitudId: string,
  tipoDocumento: string,
  archivo: File
) {
  if (!TIPOS_MIME_PERMITIDOS.includes(archivo.type)) {
    throw new ServiceError("Tipo de archivo no permitido. Solo se aceptan PDF, PNG o JPG.", 400);
  }
  if (archivo.size > TAMANO_MAX_BYTES) {
    throw new ServiceError("El archivo supera el tamaño máximo permitido de 5 MB.", 400);
  }

  const extension = archivo.name.split(".").pop();
  const nombreArchivo = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
  const storagePath = `${solicitudId}/${nombreArchivo}`;

  const { error: errorStorage } = await db.storage.from(BUCKET).upload(storagePath, archivo, {
    contentType: archivo.type,
    upsert: false,
  });
  if (errorStorage) throw new ServiceError(errorStorage.message, 400);

  const { data: documento, error } = await db
    .from("documentos")
    .insert({
      solicitud_id: solicitudId,
      tipo_documento: tipoDocumento,
      storage_path: storagePath,
      nombre_original: archivo.name,
      mime: archivo.type,
      tamano_bytes: archivo.size,
    })
    .select()
    .single();

  if (error) {
    // Revierte la subida si no se pudo registrar la fila (evita huérfanos).
    await db.storage.from(BUCKET).remove([storagePath]);
    throw new ServiceError(error.message, 400);
  }

  return documento;
}
