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
sube al repo — está en `.gitignore`). Si te falta, pide los valores a quien
provisionó el proyecto en vez de crear uno nuevo; usa `.env.example` solo como
referencia de qué variables hacen falta.

Abrir **http://localhost:3000**. Requiere haber aplicado las migraciones de
`supabase/migrations/` al proyecto Supabase (`npx supabase db push` con el CLI
enlazado, o pegar el SQL en el SQL Editor del dashboard).

Implementado hasta ahora: **HU-01** (crear solicitud) y **HU-02** (cargar
documentos, con validación de tipo/tamaño; el escaneo antimalware del pipeline
de documentos queda pendiente como Edge Function separada).

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

Automatizado con Supabase Edge Functions, disparado por un Storage Trigger al subir un archivo:

1. Subida del PDF a Supabase Storage
2. Validación de formato (MIME) y tamaño máximo
3. Escaneo antimalware (ej. ClamAV)
4. Validación de campos / adjuntos obligatorios según el tipo de trámite
5. Cambio automático de estado a "En revisión" (o rechazo automático si algo falla)

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
