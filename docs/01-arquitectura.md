# Arquitectura — Sprint 0

## Estilo arquitectónico

**Arquitectura en capas** con patrón **MVC** dentro del backend. Monolito modular
desplegado como una sola aplicación Next.js (App Router) en Vercel.

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTACIÓN                                            │
│  Next.js App Router — Server Components + Client         │
│  Components. Páginas por rol + página pública de QR.     │
└───────────────┬─────────────────────────────────────────┘
                │  fetch / Server Actions
┌───────────────▼─────────────────────────────────────────┐
│  APLICACIÓN / API  (Route Handlers en app/api/**)        │
│                                                         │
│  Controller  → valida request, auth, formato de salida  │
│      │                                                  │
│  Service     → lógica de negocio, reglas Ley 55/2008,   │
│      │          orquestación del pipeline de documentos │
│  Model       → acceso a datos vía cliente Supabase      │
│                (queries parametrizadas, nunca strings)  │
└───────────────┬─────────────────────────────────────────┘
                │  supabase-js (service role solo en servidor)
┌───────────────▼─────────────────────────────────────────┐
│  DATOS                                                   │
│  Supabase: PostgreSQL + RLS · Auth · Storage             │
│  Edge Functions (pipeline de verificación de documentos)│
└─────────────────────────────────────────────────────────┘
```

## Mapa de capas a carpetas

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Presentación | `app/(roles)/**`, `app/verificar/[codigo]/` | UI, layouts por rol, página pública |
| Controller | `app/api/**/route.ts` | Parseo, auth, validación de entrada (zod), códigos HTTP |
| Service | `lib/services/*.ts` | Reglas de negocio, transiciones de estado, orquestación |
| Model | `lib/models/*.ts` | CRUD sobre Supabase, mapeo fila↔dominio |
| Infra | `lib/supabase/` | Clientes (browser, server, admin), tipos generados |
| Edge | `supabase/functions/verificar-documento/` | Pipeline de 5 etapas disparado por Storage Trigger |

## Reglas de dependencia

- La UI **nunca** llama a `Model` directamente; pasa por `Route Handler` → `Service` → `Model`.
- `Service` no conoce `Request`/`Response` de HTTP (testeable en aislamiento con Jest).
- El cliente `admin` (service role key) **solo** se instancia en código de servidor.
- Toda consulta a BD usa el cliente Supabase (parametrizado). Prohibida la concatenación
  de SQL — requisito para pasar la auditoría con SQLMap.

## Decisiones registradas (ADR resumidos)

| # | Decisión | Motivo |
|---|---|---|
| 1 | Next.js App Router monolito (no microservicios) | Alcance académico de 10 semanas; un solo deploy |
| 2 | Supabase como BaaS (BD + Auth + Storage) | Reduce infra a mantener; RLS cubre autorización a nivel de fila |
| 3 | Pipeline de documentos en Edge Functions, no en el Route Handler | Desacopla trabajo pesado (antimalware) del request del usuario |
| 4 | Verificación de certificado = código + hash, no PKI X.509 | Firma digital real está fuera de alcance; se documenta como trabajo futuro |
| 5 | TypeScript en todo el stack | Consistencia y tipos generados desde el esquema de Supabase |
