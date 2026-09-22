"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

const ETIQUETAS_TIPO: Record<string, string> = {
  identificacion_armador: "Identificación del armador",
  certificado_nave: "Certificado de la nave",
  poder_autorizacion: "Poder o autorización",
};

type EstadoSolicitud = {
  solicitud: { numero_tramite: string; estado: string };
  documentos: { id: string; tipo_documento: string; nombre_original: string }[];
  tipos_documento_requeridos: string[];
  tipos_documento_faltantes: string[];
  lista_para_enviar: boolean;
};

async function obtenerEstado(numeroTramite: string) {
  const res = await fetch(`/api/solicitudes/${numeroTramite}`);
  return res.json();
}

// HU-02 — carga de documentos de la solicitud.
export default function DocumentosPage() {
  const { numeroTramite } = useParams<{ numeroTramite: string }>();
  const router = useRouter();

  const [estado, setEstado] = useState<EstadoSolicitud | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState("identificacion_armador");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    const data = await obtenerEstado(numeroTramite);
    if (data.ok) setEstado(data);
  }, [numeroTramite]);

  useEffect(() => {
    let activo = true;
    obtenerEstado(numeroTramite).then((data) => {
      if (activo && data.ok) setEstado(data);
    });
    return () => {
      activo = false;
    };
  }, [numeroTramite]);

  async function onSubirDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;

    setCargando(true);
    setErrores([]);

    const formData = new FormData();
    formData.append("tipo_documento", tipoDocumento);
    formData.append("archivo", archivo);

    const res = await fetch(`/api/solicitudes/${numeroTramite}/documentos`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setCargando(false);
    if (!data.ok) {
      setErrores(data.errores ?? ["No se pudo subir el documento."]);
      return;
    }

    setArchivo(null);
    await cargar();
  }

  async function onEnviar() {
    setCargando(true);
    setErrores([]);

    const res = await fetch(`/api/solicitudes/${numeroTramite}/enviar`, { method: "PUT" });
    const data = await res.json();

    setCargando(false);
    if (!data.ok) {
      setErrores(data.errores ?? ["No se pudo enviar la solicitud."]);
      return;
    }

    router.refresh();
    await cargar();
  }

  if (!estado) return <div className="card">Cargando...</div>;

  const enviada = estado.solicitud.estado !== "recibida";

  return (
    <div className="card">
      <h1>Documentación de la solicitud</h1>
      <p>
        Número de trámite: <strong>{estado.solicitud.numero_tramite}</strong> — Estado:{" "}
        <strong>{estado.solicitud.estado}</strong>
      </p>

      <h2>Documentos requeridos</h2>
      <ul className="lista-documentos">
        {estado.tipos_documento_requeridos.map((tipo) => {
          const presente = !estado.tipos_documento_faltantes.includes(tipo);
          return (
            <li key={tipo} className={presente ? "completo" : "pendiente"}>
              {presente ? "✓" : "○"} {ETIQUETAS_TIPO[tipo] ?? tipo}
            </li>
          );
        })}
      </ul>

      {!enviada && (
        <>
          <form onSubmit={onSubirDocumento}>
            <label htmlFor="tipo_documento">Tipo de documento</label>
            <select id="tipo_documento" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              {Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
              <option value="otro">Otro</option>
            </select>

            <label htmlFor="archivo">Archivo (PDF, PNG o JPG, máx. 5 MB)</label>
            <input
              id="archivo"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              required
            />

            <button type="submit" disabled={cargando || !archivo}>
              {cargando ? "Subiendo..." : "Subir documento"}
            </button>
          </form>

          <button onClick={onEnviar} disabled={cargando || !estado.lista_para_enviar}>
            Enviar solicitud a revisión
          </button>
        </>
      )}

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
