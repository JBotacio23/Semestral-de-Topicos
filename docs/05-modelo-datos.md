# Modelo de datos — Sprint 0 (diseño en papel)

> Diseño conceptual. El SQL real vive en `supabase/migrations/` y se crea por sprint.

## Diagrama de entidades

```
usuarios ──< naves ──< solicitudes ──< documentos
                           │  │
                           │  ├──< historial_estados
                           │  ├──< notificaciones
                           │  └──1 certificados
```

## Tablas

### `usuarios`
Extiende `auth.users` de Supabase (1:1 por `id`).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `nombre` | text | |
| `rol` | enum `rol_usuario` | `naviera_armador` \| `funcionario_amp` \| `aseguradora` |
| `organizacion` | text | Naviera / aseguradora a la que pertenece |
| `creado_en` | timestamptz | `default now()` |

`enum rol_usuario`. El rol se copia a `app_metadata` por trigger para uso en RLS.

### `naves`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nombre` | text | |
| `numero_imo` | text unique nullable | |
| `tipo` | text | carga, pasajeros, pesca… |
| `arqueo_bruto` | numeric | |
| `eslora_m` | numeric | |
| `bandera_anterior` | text nullable | |
| `armador_id` | uuid FK → usuarios | dueño |
| `creado_en` | timestamptz | |

### `solicitudes`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `numero_tramite` | text unique | generado al enviar: `AMP-YYYY-NNNNNN` |
| `nave_id` | uuid FK → naves | |
| `solicitante_id` | uuid FK → usuarios | |
| `estado` | enum `estado_solicitud` | ver máquina de estados |
| `funcionario_id` | uuid FK → usuarios nullable | quien la revisa |
| `creado_en` / `actualizado_en` | timestamptz | |

`enum estado_solicitud`: `borrador` → `recibida` → `en_revision` →
(`requiere_correccion` → `en_revision`)* → `aprobada` \| `rechazada`.

### `documentos`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `solicitud_id` | uuid FK → solicitudes | |
| `tipo` | enum `tipo_documento` | ej. `titulo_propiedad`, `poliza_seguro`, `certificado_arqueo` |
| `storage_path` | text | ruta en Supabase Storage |
| `mime` | text | validado por el pipeline |
| `tamano_bytes` | bigint | validado contra máximo |
| `estado_verificacion` | enum | `pendiente` \| `escaneando` \| `aprobado` \| `rechazado` |
| `resultado_antimalware` | text nullable | `limpio` \| `infectado:<firma>` |
| `motivo_rechazo` | text nullable | del pipeline automático |
| `observacion_funcionario` | text nullable | de HU-03 |
| `creado_en` | timestamptz | |

### `historial_estados`
Inmutable. Una fila por transición. Alimenta HU-06.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `solicitud_id` | uuid FK | |
| `estado_anterior` | enum nullable | |
| `estado_nuevo` | enum | |
| `comentario` | text nullable | **obligatorio** si `rechazada`/`requiere_correccion` (HU-04) |
| `cambiado_por` | uuid FK → usuarios nullable | null = sistema |
| `creado_en` | timestamptz | |

### `certificados`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `solicitud_id` | uuid FK unique | 1 por solicitud aprobada |
| `numero_certificado` | text unique | `CERT-AMP-YYYY-NNNNNN` |
| `codigo_verificacion` | text unique | aleatorio, alta entropía; va en el QR |
| `hash_documento` | text | SHA-256 del PDF emitido |
| `storage_path` | text | PDF del certificado |
| `emitido_por` | uuid FK → usuarios | funcionario que aprobó |
| `emitido_en` | timestamptz | |
| `vence_en` | timestamptz | emitido_en + N años |
| `estado` | enum `estado_certificado` | `valido` \| `vencido` (derivable) \| `revocado` |

### `notificaciones`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK | destinatario |
| `solicitud_id` | uuid FK nullable | contexto |
| `canal` | enum | `email` \| `in_app` |
| `asunto` / `cuerpo` | text | |
| `leida` | bool | `default false` |
| `enviada_en` | timestamptz | |

## Vista pública (HU-07)

`certificado_publico` — SELECT permitido a `anon` filtrando por `codigo_verificacion`:
devuelve `nombre_nave`, `numero_certificado`, `emitido_en`, `vence_en`, y `estado`
calculado (`valido` / `vencido` / `revocado`). Si el código no existe, la capa de
aplicación responde `no_existe` sin filtrar información.

## Storage (buckets)

| Bucket | Público | Contenido | Política |
|---|---|---|---|
| `documentos-solicitud` | No | PDFs/imágenes cargados por el armador | RLS: dueño de la solicitud + funcionario |
| `certificados` | No | PDFs de certificados emitidos | Lectura vía URL firmada de corta duración |

## Índices previstos

- `solicitudes(numero_tramite)`, `solicitudes(solicitante_id, estado)`
- `documentos(solicitud_id)`
- `historial_estados(solicitud_id, creado_en)`
- `certificados(codigo_verificacion)`, `certificados(numero_certificado)`
- `notificaciones(usuario_id, leida)`
