import { Resend } from "resend";

// Sin dominio verificado en Resend solo se puede enviar desde onboarding@resend.dev,
// y únicamente al correo dueño de la cuenta de Resend.
const REMITENTE_POR_DEFECTO = "Registro de Naves AMP <onboarding@resend.dev>";

/**
 * HU-01 — correo de confirmación con el número de trámite.
 * Nunca lanza: si falta la configuración o Resend falla, se registra en el
 * log y devuelve false, para no revertir una solicitud ya creada.
 */
export async function enviarConfirmacionSolicitud(email: string, numeroTramite: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada: no se envió la confirmación de", numeroTramite);
    return false;
  }

  try {
    const { error } = await new Resend(apiKey).emails.send(
      {
        from: process.env.RESEND_FROM ?? REMITENTE_POR_DEFECTO,
        to: email,
        subject: `Solicitud de registro recibida — ${numeroTramite}`,
        text:
          `Recibimos su solicitud de registro de nave.\n\n` +
          `Número de trámite: ${numeroTramite}\n\n` +
          `Use este número para cargar la documentación y dar seguimiento al trámite.\n\n` +
          `Autoridad Marítima de Panamá — Registro de Naves`,
        html:
          `<p>Recibimos su solicitud de registro de nave.</p>` +
          `<p>Número de trámite: <strong>${numeroTramite}</strong></p>` +
          `<p>Use este número para cargar la documentación y dar seguimiento al trámite.</p>` +
          `<p>Autoridad Marítima de Panamá — Registro de Naves</p>`,
      },
      // Evita correos duplicados si la misma confirmación se reintenta.
      { idempotencyKey: `confirmacion-${numeroTramite}` }
    );

    if (error) {
      console.error("Resend rechazó la confirmación de", numeroTramite, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("No se pudo enviar la confirmación de", numeroTramite, err);
    return false;
  }
}
