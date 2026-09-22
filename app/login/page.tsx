"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (errorLogin) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/solicitudes/nueva");
    router.refresh();
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
      {error && <p className="errores">{error}</p>}
    </div>
  );
}
