// HU-02 — pipeline de verificación de documentos (ver CLAUDE.md).
//
// La invoca la BD (trigger after insert on documentos → pg_net, migración
// 0006) con { documento_id } y el header x-webhook-secret. Etapas:
//   1. Descarga el archivo subido a Storage.
//   2. Revalida el formato real (magic bytes) y el tamaño.
//   3. Escaneo antimalware con ClamAV (servicio aparte, services/clamav).
//   4-5. Marca el documento aprobado/rechazado y, si ya están aprobados todos
//        los obligatorios del trámite, pasa la solicitud a "en_revision"
//        (función SQL avanzar_a_revision).
//
// Secrets: WEBHOOK_SECRET (obligatorio), CLAMAV_URL + CLAMAV_API_TOKEN, y
// ESCANEO_OBLIGATORIO=true para no aprobar nada mientras ClamAV no responda.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// Deploy: supabase functions deploy verificar-documento --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { BYTES_FIRMA, detectarMime, TAMANO_MAX_ARCHIVO } from "../_shared/archivo.ts";

const BUCKET = "documentos-solicitud";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function secretoValido(recibido: string | null): Promise<boolean> {
  const esperado = Deno.env.get("WEBHOOK_SECRET");
  if (!esperado || !recibido) return false;
  // Compara digests para no filtrar el secreto por tiempo de respuesta.
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(esperado), digest(recibido)]);
  return a.every((byte, i) => byte === b[i]);
}

type ResultadoEscaneo = { infectado: boolean; virus: string | null } | { omitido: true } | { error: string };

async function escanear(archivo: Blob): Promise<ResultadoEscaneo> {
  const url = Deno.env.get("CLAMAV_URL");
  if (!url) {
    return Deno.env.get("ESCANEO_OBLIGATORIO") === "true"
      ? { error: "CLAMAV_URL no configurada y ESCANEO_OBLIGATORIO=true" }
      : { omitido: true };
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/scan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("CLAMAV_API_TOKEN") ?? ""}`,
        "Content-Type": "application/octet-stream",
      },
      body: archivo,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { error: `ClamAV respondió ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: `ClamAV no disponible: ${err instanceof Error ? err.message : err}` };
  }
}

async function rechazar(documentoId: string, motivo: string, borrarArchivo?: string) {
  if (borrarArchivo) await admin.storage.from(BUCKET).remove([borrarArchivo]);
  const { error } = await admin
    .from("documentos")
    .update({ estado_verificacion: "rechazado", motivo_rechazo: motivo })
    .eq("id", documentoId)
    .eq("estado_verificacion", "pendiente");
  if (error) throw error;
  console.log(JSON.stringify({ documento_id: documentoId, resultado: "rechazado", motivo }));
  return json({ documento_id: documentoId, estado_verificacion: "rechazado", motivo });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!(await secretoValido(req.headers.get("x-webhook-secret")))) return json({ error: "No autorizado" }, 401);

  let documentoId: string;
  try {
    documentoId = (await req.json()).documento_id;
    if (typeof documentoId !== "string") throw new Error();
  } catch {
    return json({ error: "Se esperaba { documento_id }" }, 400);
  }

  try {
    const { data: doc, error } = await admin
      .from("documentos")
      .select("id, solicitud_id, storage_path, mime, estado_verificacion")
      .eq("id", documentoId)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return json({ error: "Documento inexistente" }, 404);
    if (doc.estado_verificacion !== "pendiente") {
      return json({ documento_id: doc.id, estado_verificacion: doc.estado_verificacion, omitido: true });
    }

    // Etapa 1: descargar de Storage
    const { data: blob, error: errorDescarga } = await admin.storage.from(BUCKET).download(doc.storage_path);
    if (errorDescarga || !blob) return await rechazar(doc.id, "El archivo no se encontró en el almacenamiento.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // Etapa 2: formato real y tamaño máximo
    if (bytes.length > TAMANO_MAX_ARCHIVO) {
      return await rechazar(doc.id, "El archivo supera el tamaño máximo permitido de 5 MB.", doc.storage_path);
    }
    if (detectarMime(bytes.subarray(0, BYTES_FIRMA)) !== doc.mime) {
      return await rechazar(doc.id, "El contenido del archivo no corresponde a un PDF, PNG o JPG válido.");
    }

    // Etapa 3: antimalware
    const escaneo = await escanear(blob);
    if ("error" in escaneo) {
      // Nunca se aprueba por omisión: queda pendiente y se reintenta
      // (reintentar_verificaciones_pendientes, migración 0006).
      console.error(JSON.stringify({ documento_id: doc.id, resultado: "pendiente", error: escaneo.error }));
      return json({ documento_id: doc.id, estado_verificacion: "pendiente", error: escaneo.error }, 503);
    }
    if ("omitido" in escaneo) {
      console.warn(JSON.stringify({ documento_id: doc.id, aviso: "etapa 3 omitida: CLAMAV_URL no configurada" }));
    } else if (escaneo.infectado) {
      return await rechazar(
        doc.id,
        `El archivo contiene malware (${escaneo.virus ?? "firma desconocida"}) y fue eliminado.`,
        doc.storage_path
      );
    }

    // Etapas 4-5: aprobar y, si el trámite ya está completo, pasar a "en_revision"
    const { error: errorUpdate } = await admin
      .from("documentos")
      .update({ estado_verificacion: "aprobado", motivo_rechazo: null })
      .eq("id", doc.id)
      .eq("estado_verificacion", "pendiente");
    if (errorUpdate) throw errorUpdate;

    const { data: avanzo, error: errorAvance } = await admin.rpc("avanzar_a_revision", {
      p_solicitud_id: doc.solicitud_id,
    });
    if (errorAvance) throw errorAvance;

    const escaneado = !("omitido" in escaneo);
    console.log(JSON.stringify({ documento_id: doc.id, resultado: "aprobado", escaneado, solicitud_en_revision: avanzo }));
    return json({ documento_id: doc.id, estado_verificacion: "aprobado", escaneado, solicitud_en_revision: avanzo });
  } catch (err) {
    console.error(JSON.stringify({ documento_id: documentoId, error: (err as { message?: string })?.message ?? String(err) }));
    return json({ error: "Error interno al verificar el documento" }, 500);
  }
});
