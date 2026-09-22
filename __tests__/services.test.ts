import type { SupabaseClient } from "@supabase/supabase-js";
import { crearSolicitud, ServiceError } from "@/lib/services/solicitudService";
import { subirDocumento } from "@/lib/services/documentoService";
import { respuestaError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarConfirmacionSolicitud } from "@/lib/services/notificacionService";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/services/notificacionService", () => ({ enviarConfirmacionSolicitud: jest.fn() }));

const input = {
  nombre_nave: "Nave Ejemplo",
  tipo_nave: "Carga",
  bandera_actual: "Panamá",
  nombre_armador: "Armador S.A.",
  identificacion_armador: "8-123-456",
  email_contacto: "contacto@ejemplo.com",
  telefono_contacto: "6000-0000",
};

describe("crearSolicitud (HU-01)", () => {
  beforeEach(() => (enviarConfirmacionSolicitud as jest.Mock).mockReset());

  it("crea todo en una sola llamada al RPC crear_solicitud y envía la confirmación", async () => {
    const creada = { numero_tramite: "AMP-2026-000001", email_contacto: "contacto@ejemplo.com" };
    const rpc = jest.fn().mockResolvedValue({ data: creada, error: null });
    const db = { rpc } as unknown as SupabaseClient;

    const solicitud = await crearSolicitud(db, input);

    expect(solicitud.numero_tramite).toBe("AMP-2026-000001");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "crear_solicitud",
      expect.objectContaining({ p_nombre_nave: "Nave Ejemplo", p_numero_omi: null })
    );
    expect(enviarConfirmacionSolicitud).toHaveBeenCalledWith("contacto@ejemplo.com", "AMP-2026-000001");
  });

  it("propaga el error de la BD como ServiceError 400 y no envía correo", async () => {
    const db = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "falló", code: "23505" } }),
    } as unknown as SupabaseClient;

    await expect(crearSolicitud(db, input)).rejects.toMatchObject({ message: "falló", status: 400 });
    expect(enviarConfirmacionSolicitud).not.toHaveBeenCalled();
  });
});

describe("subirDocumento (HU-02)", () => {
  const upload = jest.fn();
  beforeEach(() => {
    upload.mockReset();
    (createAdminClient as jest.Mock).mockReturnValue({ storage: { from: () => ({ upload }) } });
  });

  it("rechaza un ejecutable que declara ser PDF y no lo sube", async () => {
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "factura.pdf", {
      type: "application/pdf",
    });

    await expect(subirDocumento("sol-1", "certificado_nave", falso)).rejects.toMatchObject({ status: 400 });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza archivos de más de 5 MB", async () => {
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.pdf", {
      type: "application/pdf",
    });

    await expect(subirDocumento("sol-1", "certificado_nave", grande)).rejects.toMatchObject({ status: 400 });
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("respuestaError", () => {
  it("usa el status del ServiceError", async () => {
    const res = respuestaError(new ServiceError("No existe", 404));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, errores: ["No existe"] });
  });

  it("responde 500 genérico ante errores inesperados, sin exponer el detalle", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = respuestaError(new Error("connection string secreta"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secreta");
  });
});
