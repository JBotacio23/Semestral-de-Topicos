# CI/CD — Sprint 0 (diseño del pipeline)

Repositorio y pipeline en **GitLab** (`.gitlab-ci.yml`). No se usa GitHub Actions.

## Stages

| Stage | Corre en | Qué hace | Bloquea el MR |
|---|---|---|---|
| `build` | cada push/MR | `npm ci` + `npm run build` (Next.js) | Sí |
| `test` | cada push/MR | `npm run lint` + `npm run test` (Jest, unitarias de Services) | Sí |
| `security` | cada push/MR a `main` | SQLMap (imagen Docker) contra las API routes en un server efímero | No al inicio (`allow_failure: true`), luego sí |
| `e2e` | tras deploy a staging | Cypress (`cypress/included`) contra `CYPRESS_BASE_URL` | Sí |
| `deploy:staging` | merge a `main` | Aplica migraciones a Supabase `staging` + deploy a Vercel Preview | Sí |
| `deploy:prod` | manual, sobre `main` | Migraciones a `prod` + deploy a Vercel Production | — (`when: manual`) |

## Esqueleto (`.gitlab-ci.yml`)

El archivo del Sprint 0 solo **declara los stages y jobs con placeholders**. Cada sprint
rellena su job:

- Sprint 1: `build`, `test`, `deploy:staging`, `deploy:prod`, primer spec de `e2e`,
  primer perfil de `security` (SQLMap sobre el endpoint de HU-01).
- Sprint 2+: se agregan specs de Cypress y perfiles de SQLMap por cada HU nueva.

## Imágenes Docker

| Job | Imagen |
|---|---|
| `build`, `test`, `deploy` | `node:20-alpine` |
| `security` | `parrotsec/sqlmap` o `python:3.12` + `pip install sqlmap` |
| `e2e` | `cypress/included:<versión>` |

## Variables CI/CD (GitLab → Settings → CI/CD → Variables)

`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `CYPRESS_BASE_URL`, `RESEND_API_KEY`.
Todas *Masked*; las de `prod` además *Protected* (solo ramas/tags protegidos).

## Evidencias por sprint (para la rúbrica: Agilidad y DevOps = 25 pts)

Cada sprint archiva como artefactos del pipeline:
- Log del pipeline en verde (screenshot o URL del job).
- Reporte de Cypress (`mochawesome` o video en `cypress/videos`).
- Reporte de SQLMap (`--output-dir`, guardado como artifact).
- Registro de deploy a staging (URL de la Preview de Vercel).

## Pipeline de verificación de documentos (Edge Function, no es parte del CI)

Implementado en el Sprint 2 (migraciones `0004`–`0006`,
`supabase/functions/verificar-documento`, `services/clamav`).

`POST /api/solicitudes/:n/documentos` valida el MIME declarado y el real
(magic bytes) y el tamaño, sube el archivo a `documentos-solicitud` y registra
la fila en `documentos`, las dos cosas con `service_role`: el usuario no puede
escribir directo en Storage ni en `documentos`. El `INSERT` dispara un trigger
que, vía `pg_net`, invoca la Edge Function `verificar-documento`:

1. Descarga el archivo de Storage.
2. Revalida el MIME real (magic bytes) y el tamaño (≤ 5 MB; el bucket también lo impone).
3. Escaneo antimalware con ClamAV (servicio REST aparte, ver `services/clamav/README.md`).
   Sin `CLAMAV_URL` la etapa se omite y queda registrado en el log; con
   `ESCANEO_OBLIGATORIO=true` el documento queda `pendiente` hasta que ClamAV responda.
4. Valida que estén todos los `tipo_documento` obligatorios, aprobados (`contar_documentos_faltantes`).
5. Marca `documentos.estado_verificacion` (`aprobado`/`rechazado` + `motivo_rechazo`) y,
   si ya están todos, `avanzar_a_revision` pasa la solicitud a `en_revision` y lo
   registra en `historial_estados`.

Un documento rechazado se vuelve a cargar. Si la Edge Function falla, el
documento queda `pendiente` y `reintentar_verificaciones_pendientes()` lo vuelve a enviar
(se puede programar con `pg_cron`).

### Puesta en marcha (por proyecto Supabase: staging y prod)

```bash
npx supabase link --project-ref <ref>
npx supabase db push                     # migraciones 0004–0006
npx supabase functions deploy verificar-documento --no-verify-jwt
npx supabase secrets set WEBHOOK_SECRET=<secreto> CLAMAV_URL=<url> CLAMAV_API_TOKEN=<token>
```

En el SQL Editor, con el mismo `<secreto>`:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'verificacion_project_url');
select vault.create_secret('<secreto>', 'verificacion_webhook_secret');
```

Para comprobarlo, correr `supabase/scripts/verificar_ajustes_hu01_hu02.sql` en el SQL Editor.

La única etapa manual del proceso de negocio es la aprobación final del funcionario (HU-04).
