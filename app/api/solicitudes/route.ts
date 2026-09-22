import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearSolicitudSchema } from "@/lib/validation/solicitud";
import { crearSolicitud, ServiceError } from "@/lib/services/solicitudService";

// POST /api/solicitudes — HU-01: crear solicitud de registro
export async function POST(request: NextRequest) {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errores: ["Debes iniciar sesión."] }, { status: 401 });
  }

  const body = await request.json();
  const parsed = crearSolicitudSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errores: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const solicitud = await crearSolicitud(db, user.id, parsed.data);
    return NextResponse.json({ ok: true, solicitud }, { status: 201 });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ ok: false, errores: [err.message] }, { status: err.status });
    }
    throw err;
  }
}
