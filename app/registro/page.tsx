"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [pendienteConfirmar, setPendienteConfirmar] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { data, error: errorSignUp } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        // Debe estar en Supabase → Authentication → URL Configuration → Redirect URLs
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setCargando(false);
    if (errorSignUp) {
      setError(errorSignUp.message);
      return;
    }

    // Sin sesión = el proyecto exige confirmar el correo antes de ingresar.
    if (!data.session) {
      setPendienteConfirmar(true);
      return;
    }
    router.push("/solicitudes/nueva");
    router.refresh();
  }

  if (pendienteConfirmar) {
    return (
      <div className="card">
        <h1>Revisa tu correo</h1>
        <p>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo y después{" "}
          <Link href="/login">inicia sesión</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Crear cuenta (naviera / armador)</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="nombre">Nombre completo</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

        <label htmlFor="email">Correo</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={cargando}>
          {cargando ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      {error && <p className="errores">{error}</p>}
    </div>
  );
}
