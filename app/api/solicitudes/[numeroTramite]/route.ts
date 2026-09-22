import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerSolicitudPorTramite } from "@/lib/services/solicitudService";
import { respuestaError, respuestaErrores } from "@/lib/http";

// GET /api/solicitudes/:numeroTramite — consultar solicitud + documentos (HU-01/02/06)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numeroTramite: string }> }
) {
  try {
    const { numeroTramite } = await params;
    const db = await createClient();

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return respuestaErrores(["Debes iniciar sesión."], 401);

    const resultado = await obtenerSolicitudPorTramite(db, numeroTramite);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    return respuestaError(err);
  }
}
