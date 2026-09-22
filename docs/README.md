# Documentación del proyecto

## Sprint 0 — Diseño y decisiones (sin código de producto)

| Doc | Contenido | Responsable |
|---|---|---|
| [01-arquitectura.md](01-arquitectura.md) | Capas + MVC, mapa a carpetas, ADRs | Desarrollo / Arquitectura |
| [02-entornos.md](02-entornos.md) | local / staging / producción, variables, migraciones | DevOps / CI-CD Lead |
| [03-estrategia-ramas.md](03-estrategia-ramas.md) | GitLab Flow, reglas de `main`, ciclo por HU | DevOps / CI-CD Lead |
| [04-matriz-permisos.md](04-matriz-permisos.md) | RBAC: roles, matriz acción×rol, diseño RLS | Responsable de Seguridad |
| [05-modelo-datos.md](05-modelo-datos.md) | Entidades, tablas, enums, buckets, índices | Desarrollo / Arquitectura |
| [06-ci-cd.md](06-ci-cd.md) | Stages del pipeline, imágenes, evidencias por sprint | DevOps / CI-CD Lead |

Artefactos raíz relacionados: [`.gitlab-ci.yml`](../.gitlab-ci.yml) (esqueleto),
[`.env.example`](../.env.example), [`CLAUDE.md`](../CLAUDE.md).

## Checklist de cierre del Sprint 0

- [x] Alcance, HU y backlog definidos (documento académico `.docx`, lo mantiene otra persona)
- [x] Herramientas y modelo de calidad seleccionados (Cypress + SQLMap + GitLab CI + JS, ISO/IEC 25010)
- [x] Arquitectura documentada (01)
- [x] Entornos definidos (02)
- [x] Estrategia de ramas definida (03)
- [x] Matriz de permisos / diseño RLS (04)
- [x] Modelo de datos en papel (05)
- [x] Diseño del pipeline + esqueleto `.gitlab-ci.yml` (06)
- [ ] Repo creado en GitLab con `main` protegida  ← acción manual
- [ ] Proyectos Supabase `staging` y `prod` creados  ← acción manual
- [ ] Proyecto Vercel enlazado + variables CI/CD cargadas  ← acción manual

Las tres últimas se ejecutan al arrancar el **Sprint 1** (construcción real de la infra).
