"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error: errorSignUp } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    });

    setCargando(false);
    if (errorSignUp) {
      setError(errorSignUp.message);
      return;
    }
    router.push("/login");
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
