# Matriz de permisos (RBAC) — Sprint 0

## Roles

| Rol | Autenticado | Origen |
|---|---|---|
| `naviera_armador` | Sí | Se registra en el sistema; solicita y da seguimiento |
| `funcionario_amp` | Sí | Alta manual por administrador (no self-service) |
| `aseguradora` | Sí | Se registra; solo consulta y verifica |
| *(anónimo)* verificador externo | No | Público; solo la página de verificación por QR |

El rol se guarda en `usuarios.rol` y se refleja en el JWT de Supabase vía custom claim
(`app_metadata.rol`) para que las políticas RLS lo lean sin un JOIN.

## Matriz acción × rol

Leyenda: ✅ permitido · 🔸 permitido solo sobre recursos propios · ❌ denegado

| Acción | naviera_armador | funcionario_amp | aseguradora | anónimo |
|---|:---:|:---:|:---:|:---:|
| Registrarse / iniciar sesión | ✅ | ✅ | ✅ | ❌ |
| Crear solicitud de registro (HU-01) | ✅ | ❌ | ❌ | ❌ |
| Ver / listar solicitudes | 🔸 propias | ✅ todas | ❌ | ❌ |
| Cargar documentos a una solicitud (HU-02) | 🔸 propias | ❌ | ❌ | ❌ |
| Descargar documentos de una solicitud | 🔸 propias | ✅ todas | ❌ | ❌ |
| Marcar documento correcto / con observación (HU-03) | ❌ | ✅ | ❌ | ❌ |
| Aprobar / rechazar / solicitar corrección (HU-04) | ❌ | ✅ | ❌ | ❌ |
| Emitir certificado (efecto de HU-04 aprobado) | ❌ | ✅ (sistema) | ❌ | ❌ |
| Descargar certificado emitido (HU-05) | 🔸 de sus naves | ✅ | 🔸 si tiene relación con la nave | ❌ |
| Consultar estado e historial del trámite (HU-06) | 🔸 propias | ✅ todas | 🔸 relacionadas | ❌ |
| Recibir notificaciones | 🔸 propias | 🔸 asignadas | 🔸 propias | ❌ |
| Verificar certificado por código / QR (HU-07) | ✅ | ✅ | ✅ | ✅ (solo lectura, datos mínimos) |
| Gestionar usuarios / asignar rol `funcionario_amp` | ❌ | ❌ (admin) | ❌ | ❌ |

## Traducción a políticas RLS (diseño, se implementa por sprint)

| Tabla | SELECT | INSERT | UPDATE | Sprint |
|---|---|---|---|---|
| `usuarios` | fila propia; funcionario ve todas | vía trigger de signup | fila propia (datos no sensibles) | 1 |
| `naves` | dueño (`armador_id = auth.uid()`); funcionario todas | `naviera_armador` | dueño mientras solicitud no enviada | 1 |
| `solicitudes` | dueño; funcionario todas; aseguradora si relacionada | `naviera_armador` | funcionario (estado); dueño (mientras `recibida`) | 1 / 3 |
| `documentos` | dueño de la solicitud; funcionario | dueño mientras `recibida`/`requiere_correccion` | funcionario (campo observación); Edge Function (estado verificación) | 2 |
| `historial_estados` | quien pueda ver la solicitud | solo `service_role` (lo escribe el Service) | nadie (inmutable) | 3 |
| `certificados` | relacionados con la nave; **público** solo por `codigo_verificacion` con columnas limitadas (vista) | solo `service_role` | solo `service_role` (revocar) | 5 / 7 |
| `notificaciones` | `usuario_id = auth.uid()` | `service_role` | dueño (marcar leída) | 3 |

La verificación pública (HU-07) se expone mediante una **vista** `certificado_publico`
(o RPC `verificar_certificado(codigo)`) que devuelve solo: nombre de la nave, número de
certificado, fecha de emisión, fecha de vencimiento y estado (`valido`/`vencido`/`no_existe`).
Nunca expone datos del armador ni documentos.

## Principio

Autorización en **dos niveles**: (1) el `Service` valida la acción según el rol antes de
tocar la BD; (2) RLS en PostgreSQL es la última línea de defensa aunque el Service falle.
Defensa en profundidad — relevante para la evidencia de seguridad de cada sprint.
