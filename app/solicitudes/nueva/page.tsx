"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const initialForm = {
  nombre_nave: "",
  tipo_nave: "",
  numero_omi: "",
  bandera_actual: "",
  puerto_registro_actual: "",
  nombre_armador: "",
  identificacion_armador: "",
  email_contacto: "",
  telefono_contacto: "",
};

// HU-01 — formulario de solicitud de registro de nave.
export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  function onChange(campo: keyof typeof initialForm, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setErrores([]);

    const res = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setCargando(false);
    if (!data.ok) {
      setErrores(data.errores ?? ["Ocurrió un error inesperado."]);
      return;
    }

    router.push(`/solicitudes/${data.solicitud.numero_tramite}/documentos`);
  }

  return (
    <div className="card">
      <h1>Solicitud de registro de nave</h1>
      <p>HU-01 — Completa los datos de la nave y del armador.</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="nombre_nave">Nombre de la nave</label>
        <input id="nombre_nave" value={form.nombre_nave} onChange={(e) => onChange("nombre_nave", e.target.value)} required />

        <label htmlFor="tipo_nave">Tipo de nave</label>
        <input id="tipo_nave" value={form.tipo_nave} onChange={(e) => onChange("tipo_nave", e.target.value)} required />

        <label htmlFor="numero_omi">Número OMI (opcional)</label>
        <input id="numero_omi" value={form.numero_omi} onChange={(e) => onChange("numero_omi", e.target.value)} />

        <label htmlFor="bandera_actual">Bandera actual</label>
        <input id="bandera_actual" value={form.bandera_actual} onChange={(e) => onChange("bandera_actual", e.target.value)} required />

        <label htmlFor="puerto_registro_actual">Puerto de registro actual (opcional)</label>
        <input
          id="puerto_registro_actual"
          value={form.puerto_registro_actual}
          onChange={(e) => onChange("puerto_registro_actual", e.target.value)}
        />

        <label htmlFor="nombre_armador">Nombre del armador</label>
        <input id="nombre_armador" value={form.nombre_armador} onChange={(e) => onChange("nombre_armador", e.target.value)} required />

        <label htmlFor="identificacion_armador">Identificación del armador</label>
        <input
          id="identificacion_armador"
          value={form.identificacion_armador}
          onChange={(e) => onChange("identificacion_armador", e.target.value)}
          required
        />

        <label htmlFor="email_contacto">Correo de contacto</label>
        <input
          id="email_contacto"
          type="email"
          value={form.email_contacto}
          onChange={(e) => onChange("email_contacto", e.target.value)}
          required
        />

        <label htmlFor="telefono_contacto">Teléfono de contacto</label>
        <input
          id="telefono_contacto"
          value={form.telefono_contacto}
          onChange={(e) => onChange("telefono_contacto", e.target.value)}
          required
        />

        <button type="submit" disabled={cargando}>
          {cargando ? "Enviando..." : "Crear solicitud"}
        </button>
      </form>

      {errores.length > 0 && (
        <ul className="errores">
          {errores.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
