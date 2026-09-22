/**
 * HU-02 — etapa 2 del pipeline: el MIME que manda el navegador (`File.type`)
 * lo controla el cliente, así que se contrasta con la firma real del archivo
 * (magic bytes).
 *
 * TypeScript puro, sin dependencias: lo usan la API de Next.js (vía
 * lib/validation/archivo.ts) y la Edge Function verificar-documento (Deno).
 */
const FIRMAS: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

/** Bytes que hay que leer del inicio del archivo para `detectarMime`. */
export const BYTES_FIRMA = Math.max(...FIRMAS.map((f) => f.bytes.length));

/** Mismo límite que el bucket (migración 0004) y que TAMANO_MAX_BYTES. */
export const TAMANO_MAX_ARCHIVO = 5 * 1024 * 1024;

/** Devuelve el MIME según la firma del archivo, o null si no es PDF/PNG/JPG. */
export function detectarMime(cabecera: Uint8Array): string | null {
  const firma = FIRMAS.find((f) => f.bytes.every((b, i) => cabecera[i] === b));
  return firma?.mime ?? null;
}

/** La extensión del objeto en Storage sale del MIME validado, nunca del nombre. */
export const EXTENSION_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};
