# Servicio ClamAV — etapa 3 del pipeline de verificación (HU-02)

Contenedor con `clamd` (imagen oficial `clamav/clamav`) y una API REST mínima
([server.js](server.js)) que usa la Edge Function `verificar-documento`.

| Ruta | Descripción |
|---|---|
| `GET /health` | 200 si `clamd` responde; 503 mientras carga firmas |
| `POST /scan` | Body: bytes del archivo. Header `Authorization: Bearer <CLAMAV_API_TOKEN>`. Responde `{ "infectado": bool, "virus": string \| null }` |

## Requisitos

- **RAM: 2 GB como mínimo.** `clamd` carga toda la base de firmas en memoria
  (~1–1.5 GB). Con los planes gratis de 512 MB el proceso muere al arrancar.
- Variable `CLAMAV_API_TOKEN`: un secreto largo, por ejemplo `openssl rand -hex 32`.

## Despliegue (ej. Render)

1. New → Web Service → este repo, *Root Directory* `services/clamav`, runtime **Docker**.
2. Plan con 2 GB de RAM. *Health Check Path*: `/health`.
3. Variables de entorno: `CLAMAV_API_TOKEN`.

Railway, Fly.io o una VM con Docker sirven igual:

```bash
docker build -t amp-clamav services/clamav
docker run -p 8080:8080 -e CLAMAV_API_TOKEN=<token> amp-clamav
```

## Conectarlo a Supabase (staging y prod)

```bash
npx supabase secrets set CLAMAV_URL=https://<servicio> CLAMAV_API_TOKEN=<token> ESCANEO_OBLIGATORIO=true
```

Sin `CLAMAV_URL`, la Edge Function omite esta etapa y lo deja registrado en el log.
Con `ESCANEO_OBLIGATORIO=true`, en cambio, ningún documento se aprueba si ClamAV
no responde.

## Prueba

Usa el archivo de prueba estándar **EICAR** (<https://www.eicar.org/download-anti-malware-testfile/>).
Tu antivirus local probablemente lo borre al descargarlo, así que conviene
generarlo dentro del contenedor o de la VM. Resultado esperado:
`{"infectado":true,"virus":"Eicar-Test-Signature"}`.
