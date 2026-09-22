import { enviarConfirmacionSolicitud } from "@/lib/services/notificacionService";

const send = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn(() => ({ emails: { send } })) }));

describe("enviarConfirmacionSolicitud (HU-01)", () => {
  const original = process.env.RESEND_API_KEY;

  beforeEach(() => {
    send.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    process.env.RESEND_API_KEY = original;
  });

  it("envía el número de trámite al correo de contacto", async () => {
    send.mockResolvedValue({ data: { id: "1" }, error: null });

    await expect(enviarConfirmacionSolicitud("a@ejemplo.com", "AMP-2026-000001")).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@ejemplo.com", subject: expect.stringContaining("AMP-2026-000001") }),
      { idempotencyKey: "confirmacion-AMP-2026-000001" }
    );
  });

  it("no lanza si Resend devuelve error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "dominio no verificado" } });
    await expect(enviarConfirmacionSolicitud("a@ejemplo.com", "AMP-1")).resolves.toBe(false);
  });

  it("no lanza si Resend no responde", async () => {
    send.mockRejectedValue(new Error("timeout"));
    await expect(enviarConfirmacionSolicitud("a@ejemplo.com", "AMP-1")).resolves.toBe(false);
  });

  it("no intenta enviar sin RESEND_API_KEY", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(enviarConfirmacionSolicitud("a@ejemplo.com", "AMP-1")).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
