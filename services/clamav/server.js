// API REST mínima sobre clamd para la etapa 3 del pipeline de verificación
// de documentos (HU-02). La consume supabase/functions/verificar-documento.
//
//   GET  /health  → 200 si clamd responde a PING
//   POST /scan    → body: bytes del archivo (application/octet-stream)
//                   header: Authorization: Bearer <CLAMAV_API_TOKEN>
//                   200 { infectado: boolean, virus: string | null }
//
// Sin dependencias: usa el protocolo INSTREAM de clamd por TCP.

const http = require("node:http");
const net = require("node:net");
const crypto = require("node:crypto");

const PUERTO = Number(process.env.PORT ?? 8080);
const CLAMD_HOST = process.env.CLAMD_HOST ?? "127.0.0.1";
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310);
const TOKEN = process.env.CLAMAV_API_TOKEN;
const TAMANO_MAX = 6 * 1024 * 1024; // algo más que los 5 MB del bucket
const TROZO = 64 * 1024;

if (!TOKEN) {
  console.error("Falta la variable CLAMAV_API_TOKEN");
  process.exit(1);
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();

function autorizado(req) {
  const recibido = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  return crypto.timingSafeEqual(sha256(recibido), sha256(TOKEN));
}

function hablarConClamd(escribir) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT });
    let respuesta = "";
    socket.setTimeout(60_000, () => socket.destroy(new Error("clamd no respondió a tiempo")));
    socket.on("connect", () => escribir(socket));
    socket.on("data", (d) => (respuesta += d.toString()));
    socket.on("end", () => resolve(respuesta.replace(/\0/g, "").trim()));
    socket.on("error", reject);
  });
}

async function escanear(buffer) {
  const respuesta = await hablarConClamd((socket) => {
    socket.write("zINSTREAM\0");
    for (let i = 0; i < buffer.length; i += TROZO) {
      const trozo = buffer.subarray(i, i + TROZO);
      const largo = Buffer.alloc(4);
      largo.writeUInt32BE(trozo.length);
      socket.write(largo);
      socket.write(trozo);
    }
    socket.end(Buffer.alloc(4)); // trozo de largo 0 = fin del stream
  });

  // Respuestas de clamd: "stream: OK" | "stream: <firma> FOUND" | "... ERROR"
  if (respuesta.endsWith("OK")) return { infectado: false, virus: null };
  const encontrado = respuesta.match(/^stream: (.+) FOUND$/);
  if (encontrado) return { infectado: true, virus: encontrado[1] };
  throw new Error(`Respuesta inesperada de clamd: ${respuesta}`);
}

function responder(res, status, cuerpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        const pong = await hablarConClamd((s) => s.end("zPING\0"));
        return responder(res, pong === "PONG" ? 200 : 503, { clamd: pong });
      }

      if (req.method !== "POST" || req.url !== "/scan") return responder(res, 404, { error: "No encontrado" });
      if (!autorizado(req)) return responder(res, 401, { error: "No autorizado" });

      const trozos = [];
      let total = 0;
      for await (const trozo of req) {
        total += trozo.length;
        if (total > TAMANO_MAX) return responder(res, 413, { error: "Archivo demasiado grande" });
        trozos.push(trozo);
      }

      const resultado = await escanear(Buffer.concat(trozos));
      console.log(JSON.stringify({ bytes: total, ...resultado }));
      return responder(res, 200, resultado);
    } catch (err) {
      console.error(err);
      return responder(res, 503, { error: "clamd no disponible" });
    }
  })
  .listen(PUERTO, () => console.log(`API de ClamAV escuchando en :${PUERTO}`));
