import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearSolicitudSchema } from "@/lib/validation/solicitud";
import { crearSolicitud } from "@/lib/services/solicitudService";
import { leerJson, respuestaError, respuestaErrores } from "@/lib/http";

// POST /api/solicitudes — HU-01: crear solicitud de registro
export async function POST(request: NextRequest) {
  try {
    const db = await createClient();

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return respuestaErrores(["Debes iniciar sesión."], 401);

    const body = await leerJson(request);
    if (body === null) return respuestaErrores(["El cuerpo de la solicitud no es un JSON válido."], 400);

    const parsed = crearSolicitudSchema.safeParse(body);
    if (!parsed.success) {
      return respuestaErrores(
        parsed.error.issues.map((i) => i.message),
        400
      );
    }

    const solicitud = await crearSolicitud(db, parsed.data);
    return NextResponse.json({ ok: true, solicitud }, { status: 201 });
  } catch (err) {
    return respuestaError(err);
  }
}
