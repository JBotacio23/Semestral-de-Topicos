# Sistema de Registro de Naves (AMP)

Plataforma web que digitaliza el proceso de **Registro de Naves de la Autoridad Marítima
de Panamá (AMP)**, hoy manual, conforme a la **Ley 55 de 2008**. Navieras, armadores y
aseguradoras pueden iniciar, dar seguimiento y completar el abanderamiento de una nave
en línea: carga de documentación, validación por la AMP, emisión de certificados
electrónicos y verificación pública mediante código QR.

> Proyecto del curso **Tópicos Especiales I** — Universidad Tecnológica de Panamá (UTP).

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Frontend + backend | Next.js (App Router) |
| Base de datos, Auth y Storage | Supabase (PostgreSQL) |
| Despliegue | Vercel |
| Control de versiones y CI/CD | GitLab (`.gitlab-ci.yml`) |
| Pruebas E2E | Cypress |
| Pruebas de seguridad | SQLMap |
| Modelo de calidad | ISO/IEC 25010 |

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

Ya existe un `.env` en la raíz con las credenciales del proyecto Supabase (no se
sube al repo porque está en `.gitignore`). Si te falta, pide los valores a quien
provisionó el proyecto en vez de crear uno nuevo; usa `.env.example` solo como
referencia de qué variables hacen falta.

Abrir **http://localhost:3000**. Requiere haber aplicado las migraciones de
`supabase/migrations/` al proyecto Supabase (`npx supabase db push` con el CLI
enlazado, o pegar el SQL en el SQL Editor del dashboard).

Implementado hasta ahora: **HU-01** (crear solicitud y correo de confirmación con
Resend) y **HU-02** (cargar documentos con el pipeline de verificación). El escaneo
antimalware necesita el servicio de `services/clamav` desplegado aparte; mientras no
exista, la Edge Function omite esa etapa y lo deja en el log.

## Arquitectura

Arquitectura en capas con patrón MVC en el backend:

- **Presentación**: SPA/SSR que consume la API
- **Aplicación/API**: Controllers → Services (lógica de negocio) → Models (acceso a datos)
- **Datos**: PostgreSQL (Supabase) + Supabase Storage para archivos

## Usuarios del sistema

- **Naviera / Armador**: solicita el registro, carga documentación y da seguimiento
- **Funcionario AMP**: revisa y aprueba / rechaza / pide correcciones (Ley 55 de 2008)
- **Aseguradora**: consulta el estado y verifica certificados
- **Verificador externo (público)**: escanea el QR sin necesidad de cuenta

## Historias de usuario

| ID | Descripción |
|----|-------------|
| HU-01 | Iniciar solicitud de registro en línea, con número de trámite y confirmación por correo |
| HU-02 | Cargar documentación digital (PDF/imagen, tamaño máximo, campos obligatorios); el estado pasa a "En revisión" |
| HU-03 | La AMP revisa y aprueba / rechaza / pide correcciones con comentario obligatorio y notifica al solicitante |
| HU-04 | Descargar certificado electrónico con firma digital y código de verificación |
| HU-05 | Consultar el estado del trámite en tiempo real, con historial y notificaciones |
| HU-06 | Verificar la autenticidad del certificado vía QR (página pública: válido / vencido / inexistente) |

## Pipeline de verificación de documentos

Lo dispara un trigger de PostgreSQL cuando se registra el documento, y corre en la
Edge Function `verificar-documento` (detalle en [docs/06-ci-cd.md](docs/06-ci-cd.md)):

1. Subida del archivo a Supabase Storage
2. Validación del formato real (magic bytes) y del tamaño máximo de 5 MB
3. Escaneo antimalware con ClamAV
4. Validación de los adjuntos obligatorios del trámite
5. Paso automático a "En revisión" cuando todos están aprobados; un documento
   rechazado muestra el motivo y se vuelve a cargar

La única etapa manual por diseño es la aprobación final del funcionario AMP.

## CI/CD (GitLab)

1. **build** — instalar dependencias y compilar Next.js
2. **test** — lint + pruebas unitarias (Jest)
3. **security** — SQLMap contra las API routes
4. **e2e** — Cypress contra un ambiente de staging/preview
5. **deploy** — staging automático vía Vercel; producción con aprobación manual

## Alcance fuera del proyecto

No incluye integración con sistemas legados de la AMP ni interoperabilidad con
registros marítimos internacionales (documentados como trabajo futuro).

## Equipo

- QA / Testing Lead
- Responsable de Seguridad
- DevOps / CI-CD Lead
- Desarrollo / Arquitectura
