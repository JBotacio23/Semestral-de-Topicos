import { z } from "zod";

export const crearSolicitudSchema = z.object({
  nombre_nave: z.string().trim().min(1, "El nombre de la nave es obligatorio"),
  tipo_nave: z.string().trim().min(1, "El tipo de nave es obligatorio"),
  numero_omi: z.string().trim().optional(),
  bandera_actual: z.string().trim().min(1, "La bandera actual es obligatoria"),
  puerto_registro_actual: z.string().trim().optional(),
  nombre_armador: z.string().trim().min(1, "El nombre del armador es obligatorio"),
  identificacion_armador: z
    .string()
    .trim()
    .min(1, "La identificación del armador es obligatoria"),
  email_contacto: z.string().trim().email("El correo de contacto no es válido"),
  telefono_contacto: z.string().trim().min(1, "El teléfono de contacto es obligatorio"),
});

export type CrearSolicitudInput = z.infer<typeof crearSolicitudSchema>;

// Mantener sincronizado con el enum `tipo_documento` y con enviar_solicitud
// (supabase/migrations/0004_documentos_integridad.sql)
export const TIPOS_DOCUMENTO_REQUERIDOS = [
  "identificacion_armador",
  "certificado_nave",
  "poder_autorizacion",
] as const;

export const TIPOS_DOCUMENTO = [...TIPOS_DOCUMENTO_REQUERIDOS, "otro"] as const;

export const ETIQUETAS_TIPO_DOCUMENTO: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  identificacion_armador: "Identificación del armador",
  certificado_nave: "Certificado de la nave",
  poder_autorizacion: "Poder o autorización",
  otro: "Otro",
};

export const TIPOS_MIME_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg"];
export { TAMANO_MAX_ARCHIVO as TAMANO_MAX_BYTES } from "@/supabase/functions/_shared/archivo"; // 5 MB — criterio de aceptación de HU-02

export const subirDocumentoSchema = z.object({
  tipo_documento: z.enum(TIPOS_DOCUMENTO),
});
