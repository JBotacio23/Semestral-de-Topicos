import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/services/solicitudService";

/** Respuesta de error con el formato común de la API: `{ ok: false, errores }`. */
export function respuestaErrores(errores: string[], status: number) {
  return NextResponse.json({ ok: false, errores }, { status });
}

/** Lee el cuerpo JSON; devuelve null si viene vacío o mal formado (→ 400, no 500). */
export async function leerJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Traduce un error del catch de un Route Handler. Los ServiceError llevan su
 * status y mensaje; cualquier otro se registra en el log del servidor y se
 * responde como 500 genérico, sin exponer detalles internos.
 */
export function respuestaError(err: unknown) {
  if (err instanceof ServiceError) {
    return respuestaErrores([err.message], err.status);
  }
  console.error(err);
  return respuestaErrores(["Error interno del servidor."], 500);
}
