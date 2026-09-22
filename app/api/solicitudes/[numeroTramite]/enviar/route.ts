import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarSolicitud, ServiceError } from "@/lib/services/solicitudService";

// PUT /api/solicitudes/:numeroTramite/enviar — HU-02: pasar a "en_revision"
export async function PUT(
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
    const solicitud = await enviarSolicitud(db, numeroTramite);
    return NextResponse.json({ ok: true, solicitud });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ ok: false, errores: [err.message] }, { status: err.status });
    }
    throw err;
  }
}
