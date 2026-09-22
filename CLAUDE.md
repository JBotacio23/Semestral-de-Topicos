# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Contexto del proyecto: Sistema de Registro de Naves (AMP)

Proyecto universitario (UTP, curso Tópicos Especiales I) que digitaliza el proceso de
Registro de Naves de la Autoridad Marítima de Panamá (AMP), actualmente manual, bajo
la Ley 55 de 2008. Permite a navieras, armadores y aseguradoras iniciar, dar seguimiento
y completar el proceso de abanderamiento de una nave en línea: carga de documentación,
validación por la AMP, emisión de certificados electrónicos y verificación pública
mediante código QR.

## Equipo y roles

- QA / Testing Lead
- Responsable de Seguridad
- DevOps / CI-CD Lead
- Desarrollo / Arquitectura

## Arquitectura

Arquitectura en capas + patrón MVC dentro del backend:

- **Presentación**: SPA/SSR consumiendo la API
- **Aplicación/API**: Controllers → Services (lógica de negocio) → Models (acceso a datos)
- **Datos**: PostgreSQL (vía Supabase) + almacenamiento de archivos (Supabase Storage)

## Stack tecnológico (decidido y fijo, no cambiar sin avisar)

- **Frontend + backend**: Next.js (App Router)
- **Base de datos, Auth y Storage**: Supabase
- **Despliegue**: Vercel
- **Control de versiones y CI/CD**: GitLab (repo + `.gitlab-ci.yml`, NO GitHub Actions)
- **Pruebas E2E**: Cypress
- **Pruebas de seguridad**: SQLMap
- **Modelo de calidad**: ISO/IEC 25010

## Usuarios del sistema

- Naviera / Armador: solicita registro, carga documentación, da seguimiento
- Funcionario AMP: revisa, aprueba/rechaza/pide correcciones (Ley 55 de 2008)
- Aseguradora: consulta estado y verifica certificados
- Verificador externo (público): escanea QR sin necesidad de cuenta

## Historias de usuario (HU-01 a HU-06)

1. Iniciar solicitud de registro en línea, con número de trámite y confirmación por correo
2. Cargar documentación digital (PDF/imagen, tamaño máximo, campos obligatorios), estado pasa a "En revisión"
3. AMP revisa y aprueba/rechaza/pide correcciones con comentario obligatorio, notifica al solicitante
4. Descargar certificado electrónico con firma digital y código de verificación
5. Consultar estado del trámite en tiempo real, con historial y notificaciones
6. Verificar autenticidad del certificado vía QR (página pública, indica válido/vencido/inexistente)

## Pipeline de verificación de documentos

Automatizado vía Supabase Edge Functions, disparado por Storage Trigger al subir un archivo:

1. Subida del PDF a Supabase Storage
2. Validación de formato (MIME) y tamaño máximo
3. Escaneo antimalware (ej. ClamAV)
4. Validación de campos/adjuntos obligatorios según tipo de trámite
5. Cambio automático de estado a "En revisión" (o rechazo automático si falla algo)

La única etapa manual por diseño (no técnica) es la aprobación final del funcionario AMP.

## Pipeline CI/CD en GitLab (`.gitlab-ci.yml`)

1. **build**: install deps, build Next.js
2. **test**: lint + pruebas unitarias (Jest)
3. **security**: SQLMap contra las API routes (usar imagen Docker de sqlmap)
4. **e2e**: Cypress contra un ambiente de staging/preview (usar imagen `cypress/included`)
5. **deploy**: staging automático vía Vercel; producción con aprobación manual (`when: manual`)

## Alcance fuera del proyecto

No incluye integración con sistemas legados de la AMP ni interoperabilidad con
registros marítimos internacionales (se documentan como trabajo futuro).

## Instrucciones para Claude Code

- Sigue la arquitectura en capas + MVC descrita arriba
- Usa Next.js App Router con API routes/Route Handlers para el backend
- Usa el cliente de Supabase para Auth, DB y Storage
- Escribe el código pensando en que debe pasar pruebas de Cypress y ser
  auditable con SQLMap (usa queries parametrizadas / el cliente de Supabase,
  nunca concatenación de strings en SQL)
- Cuando generes un endpoint que reciba archivos, implementa las 5 etapas del
  pipeline de verificación de documentos como se describe arriba
- Mantén el código en JavaScript/TypeScript, consistente con el stack definido
- CI/CD es GitLab, no GitHub Actions
