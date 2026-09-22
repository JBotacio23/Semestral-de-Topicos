import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarSolicitud } from "@/lib/services/solicitudService";
import { respuestaError, respuestaErrores } from "@/lib/http";

// PUT /api/solicitudes/:numeroTramite/enviar — HU-02: pasar a "en_revision"
export async function PUT(
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

    const solicitud = await enviarSolicitud(db, numeroTramite);
    return NextResponse.json({ ok: true, solicitud });
  } catch (err) {
    return respuestaError(err);
  }
}
