# Entornos y configuración — Sprint 0

## Los tres entornos

| Entorno | Dónde corre | Base de datos | Propósito | Despliegue |
|---|---|---|---|---|
| **local** | Máquina de cada dev | Proyecto Supabase `dev` (compartido) o Supabase local vía CLI | Desarrollo y pruebas unitarias | `npm run dev` |
| **staging** | Vercel (Preview) | Proyecto Supabase `staging` | Pruebas E2E (Cypress) y demo al cliente | Automático al mergear a `main` |
| **producción** | Vercel (Production) | Proyecto Supabase `prod` | Entrega final / evaluación | Manual (`when: manual` en GitLab) |

> Nota: Supabase da 2 proyectos gratis por organización. Plan: `staging` y `prod` como
> proyectos separados; para `local` se usa **Supabase CLI local** (Docker) o el proyecto
> `staging` con un esquema `dev` si no alcanza. Decisión final al inicio del Sprint 1.

## Variables de entorno

Archivo `.env.local` (nunca se commitea — ya está en `.gitignore`). Plantilla en
`.env.example` (sí se commitea, sin valores reales).

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto Supabase del entorno |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | Clave anónima (respeta RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Bypassa RLS. Solo en Route Handlers / Edge Functions |
| `SUPABASE_PROJECT_REF` | CI | Referencia del proyecto para migraciones |
| `SUPABASE_DB_PASSWORD` | CI | Aplicar migraciones desde el pipeline |
| `RESEND_API_KEY` (o SMTP) | servidor | Envío de correos (HU-01, HU-04, HU-06) |
| `CYPRESS_BASE_URL` | CI | URL de staging para el stage `e2e` |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | CI | Deploy desde GitLab |

Los secretos viven en **GitLab CI/CD Variables** (Settings → CI/CD → Variables),
marcados como *Masked* y *Protected* los de producción.

## Gestión del esquema de BD

- Migraciones versionadas en `supabase/migrations/*.sql` (generadas con Supabase CLI).
- Se aplican en orden: `staging` automático en el pipeline, `prod` en el job manual.
- Nada de cambios manuales por el dashboard en `staging`/`prod` — todo por migración.

## Datos de prueba

- `supabase/seed.sql`: usuarios de cada rol, 2–3 naves y solicitudes en distintos estados.
- Se carga en `local` y `staging`. **Nunca** en `prod`.
