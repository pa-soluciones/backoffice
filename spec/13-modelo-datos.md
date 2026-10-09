# 13 — Modelo de datos

PostgreSQL. Convenciones: PK `id uuid` (v7), `created_at`/`updated_at timestamptz`, `created_by uuid → users`, `deleted_at timestamptz` (soft delete) en las entidades de negocio. Montos `numeric(14,2)`; tipo de cambio `numeric(14,4)`. Enums como `text` + `CHECK` (más fácil de migrar).

## 1. Diagrama (resumen)

```
users ─< user_roles >─ roles ─< role_permissions
users ─< user_permissions
clientes ─< obras ─< presupuestos ─< presupuesto_revisiones ─< items
              │           ├─< adicionales ─< items
              │           ├─< presupuesto_asignados >─ users
              │           ├─< estado_historial
              │           ├─< visitas
              │           ├─< registros_campo ─< archivos (fotos)
              │           ├─< documentos ─< documento_versiones
              │           ├─< cobros_esperados ─< cobros
              │           ├─< gastos
              │           └─< stock_movimientos
              ├─< reportes_mensuales (documentos)
directores_obra ─< obras
articulos ─< stock_movimientos
proveedores ─< compras ─< stock_movimientos
```

## 2. Tablas

### Identidad y acceso
| Tabla | Columnas clave |
|---|---|
| `users` | `id`, `kind` (`interno`\|`cliente`), `username` uq, `email` uq null, `email_verified`, `nombre`, `apellido`, `telefono`, `firma_archivo_id` null, `activo`, `must_change_password`, `must_complete_setup`, `two_factor_enabled`, `cliente_id` null (para portal futuro) |
| `auth_*` | Tablas de Better Auth: `session`, `account` (hash de contraseña), `verification`, `two_factor` (secret, backup codes) |
| `recovery_secrets` | `user_id` pk, `frase_hash`, `email_recuperacion`, `email_verificado_at` |
| `roles` | `id`, `nombre` uq, `descripcion`, `es_sistema`, `requiere_2fa` |
| `role_permissions` / `user_permissions` | `role_id`/`user_id`, `modulo`, `accion`, `alcance` (`todos`\|`asignados`) — uq por (owner, modulo, accion) |
| `user_roles` | `user_id`, `role_id` |
| `mcp_tokens` | `id`, `user_id`, `nombre`, `token_hash` uq, `ultimos4`, `expires_at`, `revoked_at`, `last_used_at`, `last_used_ip` |
| `push_subscriptions` | `id`, `user_id`, `endpoint` uq, `p256dh`, `auth`, `user_agent` |
| `audit_log` | `id` bigserial, `at`, `actor_user_id`, `source`, `mcp_token_id` null, `action`, `entity_type`, `entity_id`, `entity_label` (ej. `2026/0105`), `diff` jsonb, `ip`, `user_agent` — append-only (sin UPDATE/DELETE: trigger o permisos de rol DB) |

### Clientes y obras
| Tabla | Columnas clave |
|---|---|
| `clientes` | `razon_social`, `razon_social_norm` (lower+unaccent, uq), `cuit` null, `telefono`, `email`, `notas`, `archivado` |
| `cliente_contactos` | `cliente_id`, `nombre`, `cargo`, `telefono`, `email` |
| `directores_obra` | `nombre`, `telefono`, `email`, `empresa`, `notas` |
| `proveedores` | `nombre`, `cuit` null, `telefono`, `email`, `notas` |
| `obras` | `cliente_id`, `nombre` null, `direccion` (texto impreso), `localidad`, `provincia`, `lat`/`lng` null, `director_id` null, `hys_nombre`, `hys_firma_archivo_id` null, `notas` |

### Presupuestos
| Tabla | Columnas clave |
|---|---|
| `numeracion_anual` | `anio` pk, `proximo_numero` int, `numero_inicial` int |
| `presupuestos` | `anio` null, `numero` null, `codigo` (generado: `anio/lpad(numero,4)`) uq null, `cliente_id` null, `obra_id` null, `estado`, `estado_anterior`, `requiere_visita`, `moneda`, `tipo_cambio_ref`, `incluye_iva`, `iva_pct`, `validez_dias`, `forma_contratacion`, `base_ajuste`, `anticipo_pct`, `bonif_tipo` null, `bonif_valor` null, `fecha_confirmacion` null, `motivo_cierre` null, contacto prospecto (`contacto_nombre`, `contacto_telefono`, `contacto_email`, `origen`, `pedido`), `revision_vigente_id` null, `resumen_final` jsonb null — uq (`anio`,`numero`) |
| `presupuesto_revisiones` | `presupuesto_id`, `nro` (0 = original), `estado` (`borrador`\|`emitida`\|`reemplazada`), `emitida_at`, `total_neto` (cache al emitir) |
| `adicionales` | `presupuesto_id`, `nro` (ADn), `estado`, `moneda`, `validez_dias`, `anticipo_pct`, `mantiene_bonificacion`, `aprobado_at` — uq (`presupuesto_id`,`nro`) |
| `items` | `revision_id` null \| `adicional_id` null (exactamente uno, CHECK), `nro`, `tipo_servicio`, `elemento`, `diametro_mm`, `espesor_cm`, `unidad`, `cantidad numeric(12,2)`, `precio_unitario`, `descripcion`, `descripcion_manual` bool |
| `presupuesto_asignados` | `presupuesto_id`, `user_id`, `rol_trabajo` (`responsable`\|`operario`) |
| `estado_historial` | `presupuesto_id` \| `adicional_id`, `desde`, `hasta`, `motivo`, `datos` jsonb, `user_id`, `at` |
| `visitas` | `presupuesto_id`, `inicio`, `duracion_min`, `direccion`, `contacto_sitio`, `estado`, `notas_previas`, `notas_resultado`, `motivo_omision` |
| `visita_responsables` | `visita_id`, `user_id` |
| `jornadas` | `presupuesto_id`, `fecha`, `notas` + `jornada_operarios(jornada_id, user_id)` |
| `servicios_catalogo` [C] | `tipo_servicio`, `elemento`, `diametro_mm`, `espesor_desde/hasta`, `unidad`, `precio`, `moneda`, `vigente_desde` |

### Documentos y archivos
| Tabla | Columnas clave |
|---|---|
| `plantillas` | `tipo_documento`, `version`, `archivo_id`, `sha256`, `activa`, `tags_requeridos` jsonb |
| `documentos` | `tipo`, `presupuesto_id` null, `adicional_id` null, `obra_id` null, `periodo` (`2026-08`, solo reporte mensual), `codigo`, `sufijo_nro`, `estado` (`borrador`\|`emitido`), `version_actual_id`, `emitido_at`, `emitido_por`, `snapshot` jsonb (al emitir), `plantilla_id`, `docx_archivo_id`, `pdf_archivo_id`, `pdf_estado` (`ok`\|`pendiente`\|`error`), `parametros` jsonb (ej. tipo parcial/final, rango de fechas, anexo fotográfico) |
| `documento_versiones` | `documento_id`, `nro`, `bloques` jsonb (`{bloqueId: texto}`), `origen` (`usuario`\|`ia`\|`mcp`), `user_id`, `at` |
| `archivos` | `r2_key` uq, `nombre`, `mime`, `bytes`, `sha256`, `ancho`/`alto` null, `thumb_r2_key` null, `categoria`, `descripcion`, `entidad_tipo`, `entidad_id`, `capturado_at` null, `client_id` uuid uq null (idempotencia offline), `incluir_en_documento` bool |
| `textos_default` | `tipo_documento`, `bloque_id`, `texto`, `orden` |

### Campo
| Tabla | Columnas clave |
|---|---|
| `registros_campo` | `presupuesto_id`, `item_id` null, `fecha`, `piso`, `elemento`, `tipo_servicio`, `espesor_cm`, `diametro_mm`, `unidad`, `cantidad`, `estado`, `observacion`, `client_id` uq null |
| `registro_operarios` | `registro_id`, `user_id` |

### Stock y finanzas
| Tabla | Columnas clave |
|---|---|
| `articulos` | `nombre`, `categoria`, `unidad`, `atributos` jsonb, `stock_minimo` null, `costo_promedio_ars`, `foto_archivo_id` null, `activo` |
| `compras` | `fecha`, `proveedor_id` null, `destino_presupuesto_id` null, `moneda`, `tipo_cambio`, `total`, `comprobante_archivo_id` null |
| `stock_movimientos` | `articulo_id`, `tipo`, `cantidad` (+/−), `ubicacion_desde` / `ubicacion_hacia` (`deposito` \| presupuesto_id), `costo_unitario_ars`, `compra_id` null, `motivo`, `fecha`, `client_id` uq null |
| `categorias_gasto` | `nombre`, `activa` |
| `gastos` | `fecha`, `presupuesto_id` null, `categoria_id`, `descripcion`, `importe`, `moneda`, `tipo_cambio`, `proveedor_id` null, `comprobante_archivo_id` null, `client_id` uq null |
| `cobros_esperados` | `presupuesto_id`, `adicional_id` null, `concepto` (`anticipo`\|`saldo`\|`adicional`\|`otro`), `importe`, `moneda`, `estado` |
| `cobros` | `cobro_esperado_id`, `fecha`, `importe`, `moneda_recibida`, `tipo_cambio`, `importe_imputado`, `medio`, `referencia`, `comprobante_archivo_id` null |

### Notificaciones, IA, configuración
| Tabla | Columnas clave |
|---|---|
| `notificaciones` | `user_id`, `tipo`, `titulo`, `cuerpo`, `link`, `entidad_tipo`, `entidad_id`, `leida_at`, `agrupada_count` |
| `notif_preferencias` | `user_id`, `categoria`, `push`, `email` |
| `notif_enviados` | `tipo`, `entidad_id`, `fecha`, `user_id` — uq (idempotencia del cron) |
| `email_outbox` | `to`, `template`, `data` jsonb, `estado`, `intentos`, `ultimo_error` |
| `ia_config` | `proveedor`, `modelo`, `base_url`, `api_key_cifrada`, `limite_mensual`, `sugerir_precios` bool |
| `ia_uso` | `user_id`, `funcion`, `proveedor`, `modelo`, `tokens_in`, `tokens_out`, `ms`, `documento_id` |
| `configuracion` | clave/valor jsonb: datos de empresa (razón social, WhatsApp, mail, web, logo), defaults (validez, anticipo, IVA, forma de contratación, base de ajuste), firmas por tipo de documento, días de recordatorio |

## 3. Índices destacados
- `GIN (codigo gin_trgm_ops)`, `GIN (unaccent(direccion) gin_trgm_ops)`, `GIN (razon_social_norm gin_trgm_ops)`, `GIN (unaccent(nombre) gin_trgm_ops)` en directores.
- `presupuestos (estado, updated_at desc)`, `presupuesto_asignados (user_id)`, `registros_campo (presupuesto_id, fecha)`, `stock_movimientos (articulo_id)`, `audit_log (entity_type, entity_id, at desc)`.

## 4. Vistas / cálculos
- `v_stock_por_ubicacion` (suma de movimientos por artículo y ubicación).
- `v_balance_perforaciones` (cotizado vs ejecutado por presupuesto y Ø).
- `v_saldo_presupuesto` (esperado − cobrado).
Las reglas de cálculo viven en `domain/` (TypeScript) y las vistas SQL solo agregan; los tests de `domain/` son la referencia.
