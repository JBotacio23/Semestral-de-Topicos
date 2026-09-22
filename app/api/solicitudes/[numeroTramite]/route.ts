import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerSolicitudPorTramite, ServiceError } from "@/lib/services/solicitudService";

// GET /api/solicitudes/:numeroTramite — consultar solicitud + documentos (HU-01/02/06)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numeroTramite: string }> }
) {
  const { numeroTramite } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errores: ["Debes iniciar sesión."] }, { status: 401 });
  }

  try {
    const resultado = await obtenerSolicitudPorTramite(db, numeroTramite);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ ok: false, errores: [err.message] }, { status: err.status });
    }
    throw err;
  }
}
