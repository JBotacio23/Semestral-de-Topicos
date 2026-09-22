import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerSolicitudPorTramite, ServiceError } from "@/lib/services/solicitudService";
import { subirDocumento } from "@/lib/services/documentoService";
import { subirDocumentoSchema } from "@/lib/validation/solicitud";

// POST /api/solicitudes/:numeroTramite/documentos — HU-02: cargar un documento
export async function POST(
  request: NextRequest,
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
    const { solicitud } = await obtenerSolicitudPorTramite(db, numeroTramite);

    if (solicitud.estado !== "recibida") {
      return NextResponse.json(
        { ok: false, errores: ["La solicitud ya fue enviada; no se pueden agregar más documentos."] },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const archivo = formData.get("archivo");
    const tipoDocumentoRaw = formData.get("tipo_documento");

    if (!(archivo instanceof File)) {
      return NextResponse.json({ ok: false, errores: ["Debes seleccionar un archivo."] }, { status: 400 });
    }

    const parsedTipo = subirDocumentoSchema.safeParse({ tipo_documento: tipoDocumentoRaw });
    if (!parsedTipo.success) {
      return NextResponse.json(
        { ok: false, errores: ["Debes indicar un tipo de documento válido."] },
        { status: 400 }
      );
    }

    const documento = await subirDocumento(db, solicitud.id, parsedTipo.data.tipo_documento, archivo);
    return NextResponse.json({ ok: true, documento }, { status: 201 });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ ok: false, errores: [err.message] }, { status: err.status });
    }
    throw err;
  }
}
