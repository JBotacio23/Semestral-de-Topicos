import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerSolicitudPorTramite } from "@/lib/services/solicitudService";
import { subirDocumento } from "@/lib/services/documentoService";
import { subirDocumentoSchema } from "@/lib/validation/solicitud";
import { respuestaError, respuestaErrores } from "@/lib/http";

// POST /api/solicitudes/:numeroTramite/documentos — HU-02: cargar un documento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numeroTramite: string }> }
) {
  try {
    const { numeroTramite } = await params;
    const db = await createClient();

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return respuestaErrores(["Debes iniciar sesión."], 401);

    // Autorización con el cliente del usuario (RLS): solo encuentra
    // solicitudes propias. subirDocumento escribe luego con el cliente admin.
    const { solicitud } = await obtenerSolicitudPorTramite(db, numeroTramite);

    if (solicitud.estado !== "recibida") {
      return respuestaErrores(["La solicitud ya fue enviada; no se pueden agregar más documentos."], 400);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return respuestaErrores(["El cuerpo debe ser multipart/form-data."], 400);
    }

    const archivo = formData.get("archivo");
    if (!(archivo instanceof File)) {
      return respuestaErrores(["Debes seleccionar un archivo."], 400);
    }

    const parsedTipo = subirDocumentoSchema.safeParse({ tipo_documento: formData.get("tipo_documento") });
    if (!parsedTipo.success) {
      return respuestaErrores(["Debes indicar un tipo de documento válido."], 400);
    }

    const documento = await subirDocumento(solicitud.id, parsedTipo.data.tipo_documento, archivo);
    return NextResponse.json({ ok: true, documento }, { status: 201 });
  } catch (err) {
    return respuestaError(err);
  }
}
