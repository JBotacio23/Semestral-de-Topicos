"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO } from "@/lib/validation/solicitud";

const ETIQUETAS_TIPO: Record<string, string> = ETIQUETAS_TIPO_DOCUMENTO;

const ETIQUETAS_VERIFICACION: Record<string, string> = {
  pendiente: "Verificando…",
  aprobado: "Verificado",
  rechazado: "Rechazado",
};

// Cada cuánto se consulta el estado mientras hay documentos en verificación.
const INTERVALO_REFRESCO_MS = 4000;

type EstadoSolicitud = {
  solicitud: { numero_tramite: string; estado: string };
  documentos: {
    id: string;
    tipo_documento: string;
    nombre_original: string;
    estado_verificacion: string;
    motivo_rechazo: string | null;
  }[];
  tipos_documento_requeridos: string[];
  tipos_documento_faltantes: string[];
  lista_para_enviar: boolean;
};

async function obtenerEstado(numeroTramite: string) {
  const res = await fetch(`/api/solicitudes/${numeroTramite}`);
  return res.json();
}

// HU-02 — carga de documentos de la solicitud. La verificación (formato,
// antimalware, completitud) la hace el pipeline automático; cuando aprueba el
// último documento obligatorio, la solicitud pasa sola a "en_revision".
export default function DocumentosPage() {
  const { numeroTramite } = useParams<{ numeroTramite: string }>();

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

  const hayPendientes =
    estado?.solicitud.estado === "recibida" &&
    estado.documentos.some((d) => d.estado_verificacion === "pendiente");

  useEffect(() => {
    if (!hayPendientes) return;
    const id = setInterval(cargar, INTERVALO_REFRESCO_MS);
    return () => clearInterval(id);
  }, [hayPendientes, cargar]);

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

  if (!estado) return <div className="card">Cargando...</div>;

  const enviada = estado.solicitud.estado !== "recibida";

  return (
    <div className="card">
      <h1>Documentación de la solicitud</h1>
      <p>
        Número de trámite: <strong data-cy="numero-tramite">{estado.solicitud.numero_tramite}</strong> — Estado:{" "}
        <strong data-cy="estado-solicitud">{estado.solicitud.estado}</strong>
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

      {estado.documentos.length > 0 && (
        <>
          <h2>Documentos cargados</h2>
          <ul className="lista-documentos" data-cy="documentos-cargados">
            {estado.documentos.map((doc) => (
              <li key={doc.id} className={`verificacion-${doc.estado_verificacion}`}>
                {ETIQUETAS_TIPO[doc.tipo_documento] ?? doc.tipo_documento} — {doc.nombre_original}:{" "}
                <strong>{ETIQUETAS_VERIFICACION[doc.estado_verificacion] ?? doc.estado_verificacion}</strong>
                {doc.motivo_rechazo && <span> ({doc.motivo_rechazo} Vuelva a cargarlo.)</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {enviada ? (
        <p className="completo">
          La documentación fue verificada y la solicitud está en revisión por la AMP.
        </p>
      ) : (
        <>
          <form onSubmit={onSubirDocumento}>
            <label htmlFor="tipo_documento">Tipo de documento</label>
            <select id="tipo_documento" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              {TIPOS_DOCUMENTO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO[valor]}
                </option>
              ))}
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

          <p>
            Cuando los documentos obligatorios estén cargados y verificados, la solicitud pasará
            automáticamente a revisión.
          </p>
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
