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

Se implementa en el Sprint 2. Disparado por **Storage Trigger** al subir a
`documentos-solicitud`:

1. Descarga el archivo del evento.
2. Valida MIME real (magic bytes) y `tamano_bytes` ≤ máximo por tipo.
3. Escaneo antimalware (ClamAV vía servicio/daemon).
4. Valida que estén todos los `tipo_documento` obligatorios para el trámite.
5. Actualiza `documentos.estado_verificacion` y, si todos aprobados, mueve la
   `solicitud` a `en_revision`; si algo falla, `requiere_correccion` + notificación.

La única etapa manual del proceso de negocio es la aprobación final del funcionario (HU-04).
