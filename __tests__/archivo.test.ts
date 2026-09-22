import { detectarMime, EXTENSION_POR_MIME } from "@/lib/validation/archivo";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("detectarMime (HU-02, etapa 2)", () => {
  it("reconoce un PDF por su firma %PDF-", () => {
    expect(detectarMime(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("reconoce un PNG", () => {
    expect(detectarMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("reconoce un JPG", () => {
    expect(detectarMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("rechaza un ejecutable renombrado a .pdf", () => {
    expect(detectarMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // "MZ"
  });

  it("rechaza un archivo vacío o truncado", () => {
    expect(detectarMime(bytes())).toBeNull();
    expect(detectarMime(bytes(0x25, 0x50))).toBeNull();
  });

  it("tiene extensión para cada MIME permitido", () => {
    expect(EXTENSION_POR_MIME).toEqual({
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
    });
  });
});
