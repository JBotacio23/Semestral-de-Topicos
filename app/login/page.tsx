"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

// Supabase Auth exige confirmar el correo antes del primer inicio de sesión
// (Authentication → Providers → Email → "Confirm email").
function mensajeDeError(codigo: string | undefined, mensaje: string) {
  switch (codigo) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Todavía no confirmaste tu correo. Abre el enlace que te enviamos al registrarte.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    default:
      return `No se pudo iniciar sesión: ${mensaje}`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinConfirmar, setSinConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setAviso(null);

    const supabase = createClient();
    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (errorLogin) {
      setSinConfirmar(errorLogin.code === "email_not_confirmed");
      setError(mensajeDeError(errorLogin.code, errorLogin.message));
      return;
    }
    router.push("/solicitudes/nueva");
    router.refresh();
  }

  async function onReenviarConfirmacion() {
    setCargando(true);
    const { error: errorReenvio } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setCargando(false);

    if (errorReenvio) {
      setError(mensajeDeError(errorReenvio.code, errorReenvio.message));
      return;
    }
    setError(null);
    setSinConfirmar(false);
    setAviso(`Te reenviamos el correo de confirmación a ${email}.`);
  }

  return (
    <div className="card">
      <h1>Iniciar sesión</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      {error && <p className="errores" data-cy="error-login">{error}</p>}
      {sinConfirmar && (
        <button type="button" onClick={onReenviarConfirmacion} disabled={cargando}>
          Reenviar correo de confirmación
        </button>
      )}
      {aviso && <p className="completo">{aviso}</p>}
    </div>
  );
}
