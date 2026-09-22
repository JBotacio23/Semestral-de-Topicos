import { crearSolicitudSchema, TAMANO_MAX_BYTES, TIPOS_MIME_PERMITIDOS } from "@/lib/validation/solicitud";

describe("crearSolicitudSchema (HU-01)", () => {
  const base = {
    nombre_nave: "Nave Ejemplo",
    tipo_nave: "Carga",
    bandera_actual: "Panamá",
    nombre_armador: "Armador S.A.",
    identificacion_armador: "8-123-456",
    email_contacto: "contacto@ejemplo.com",
    telefono_contacto: "6000-0000",
  };

  it("acepta una solicitud con todos los campos obligatorios", () => {
    expect(crearSolicitudSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza cuando falta el nombre de la nave", () => {
    const { nombre_nave, ...sinNombre } = base;
    const resultado = crearSolicitudSchema.safeParse(sinNombre);
    expect(resultado.success).toBe(false);
  });

  it("rechaza un correo de contacto con formato inválido", () => {
    const resultado = crearSolicitudSchema.safeParse({ ...base, email_contacto: "no-es-un-correo" });
    expect(resultado.success).toBe(false);
  });
});

describe("reglas de documentos (HU-02)", () => {
  it("solo permite PDF, PNG o JPG", () => {
    expect(TIPOS_MIME_PERMITIDOS).toEqual(["application/pdf", "image/png", "image/jpeg"]);
  });

  it("el tamaño máximo es de 5 MB", () => {
    expect(TAMANO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
