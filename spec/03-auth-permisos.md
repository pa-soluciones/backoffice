# 03 — Autenticación, roles, permisos y auditoría

## 1. Administrador inicial (bootstrap)

**RF-AUTH-01 [M]** En el primer deploy, si no existe ningún usuario, se crea el admin con `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (variables de entorno). Flag `must_complete_setup = true`.

**RF-AUTH-02 [M]** En el primer login, el admin es redirigido a un asistente obligatorio (no puede salir de él hasta completarlo):
1. **Nueva contraseña** (no puede ser igual a la de bootstrap).
2. **Frase de recuperación** (mín. 4 palabras / 20 caracteres) + confirmación. Se guarda hasheada (argon2id). Se muestra una sola vez.
3. **Correo de recuperación** → se envía un código de 6 dígitos (validez 15 min, máx. 5 intentos) vía Resend. Sin validar, no avanza.
4. **2FA TOTP**: QR + verificación del primer código + 10 backup codes para descargar o imprimir. Obligatorio para administradores.

Al finalizar: `must_complete_setup = false`, se invalidan las otras sesiones y se registra en auditoría.

> Si Resend no está configurado aún, el paso 3 muestra un error claro: "Configurar RESEND_API_KEY y el dominio antes de continuar". No se permite saltear la validación.

## 2. Login y sesiones

**RF-AUTH-03 [M]** Login con email (o nombre de usuario) + contraseña, y luego TOTP si el usuario tiene 2FA.
**RF-AUTH-04 [M]** Bloqueo temporal tras 5 intentos fallidos (15 min), por cuenta y por IP.
**RF-AUTH-05 [M]** Sesión en cookie httpOnly, `Secure`, `SameSite=Lax`. Duración 30 días deslizante; sin "Recordarme en este dispositivo" la cookie dura hasta cerrar el navegador.
**RF-AUTH-06 [M]** Contraseña: mín. 10 caracteres; hash argon2id/scrypt (lo que provea Better Auth).
**RF-AUTH-07 [S]** El usuario ve sus sesiones activas (dispositivo, última actividad) y puede cerrarlas.

## 3. Recuperación de acceso

| Caso | Flujo |
|---|---|
| Admin olvidó la contraseña | Link al correo de recuperación **+** frase de recuperación → nueva contraseña. Se mantiene 2FA. |
| Admin perdió el 2FA | Backup code. Si no tiene: correo + frase → reset de 2FA (obliga a reconfigurar). |
| Usuario común olvidó la contraseña | Si tiene email validado: link por email. Si no: un admin genera una contraseña temporal (`must_change_password = true`). |
| Usuario común perdió el 2FA | Un admin resetea su 2FA. |

**RF-AUTH-08 [M]** Toda recuperación o reset queda en auditoría y notifica a todos los admins.

## 4. Usuarios

**RF-USR-01 [M]** Solo usuarios con `usuarios.escribir` crean usuarios: nombre y apellido (un campo), usuario, email (opcional; si se carga se valida), teléfono, roles, permisos adicionales, **imagen de firma** (opcional, PNG con transparencia), estado activo/inactivo.
**RF-USR-02 [M]** Alta con contraseña temporal → cambio obligatorio en el primer login. 2FA opcional para no-admins (configurable por rol: "2FA obligatorio").
**RF-USR-03 [M]** Los usuarios no se eliminan físicamente si tienen actividad: se **desactivan** (no pueden loguearse, se revocan sesiones y tokens MCP, se conservan en el historial).
**RF-USR-04 [M]** Siempre debe existir al menos un admin activo (el sistema impide desactivar o quitar el rol al último).
**RF-USR-05 [C]** Tipo de usuario `cliente` (portal de clientes): previsto en el modelo (`users.kind`), sin UI en v1.

## 5. Roles y permisos

### 5.1 Modelo
- **Permiso** = `módulo` + `acción` + `alcance`.
  - Acciones: `leer`, `escribir` (crear + editar), `eliminar`.
  - Acciones especiales (solo donde aplica): `cambiar_estado`, `emitir`, `ver_montos`.
  - Alcance: `todos` | `asignados` (solo presupuestos/obras donde el usuario está asignado).
- **Rol** = conjunto nombrado de permisos (CRUD por el admin).
- **Usuario** = 0..n roles + permisos adicionales directos. Los permisos efectivos son la **unión** (solo suman; no hay permisos de denegación).
- Rol de sistema **Administrador**: todos los permisos, no editable ni eliminable.
- `eliminar` implica `escribir`, y `escribir` implica `leer` (la UI lo marca automáticamente).

### 5.2 Módulos

| Módulo | leer | escribir | eliminar | Especiales | Alcance |
|---|---|---|---|---|---|
| `clientes` (incluye directores de obra) | ✔ | ✔ | ✔ | — | todos |
| `obras` | ✔ | ✔ | ✔ | — | todos / asignados |
| `presupuestos` | ✔ | ✔ | ✔ | `cambiar_estado`, `ver_montos` | todos / asignados |
| `documentos` | ✔ | ✔ | ✔ | `emitir` | todos / asignados |
| `campo` (control de perforaciones, fotos) | ✔ | ✔ | ✔ | — | todos / asignados |
| `agenda` | ✔ | ✔ | ✔ | — | todos / asignados |
| `anexos` | ✔ | ✔ | ✔ | — | todos / asignados |
| `stock` | ✔ | ✔ | ✔ | `ver_montos` | todos |
| `gastos` | ✔ | ✔ | ✔ | — | todos / asignados |
| `cobros` | ✔ | ✔ | ✔ | — | todos |
| `finanzas` (resúmenes) | ✔ | — | — | — | todos |
| `usuarios` | ✔ | ✔ | ✔ | — | — |
| `roles` | ✔ | ✔ | ✔ | — | — |
| `configuracion` (empresa, numeración, plantillas, IA, integraciones) | ✔ | ✔ | — | — | — |
| `auditoria` | ✔ | — | — | — | — |
| `ia` (usar asistente) | — | ✔ | — | — | — |
| `mcp` (crear tokens propios) | — | ✔ | — | — | — |

**`ver_montos`:** sin este permiso se ocultan precios, totales, costos y cobros en UI, documentos de vista previa y respuestas MCP. El usuario igual ve cantidades y descripciones. (Ej.: un operario registra perforaciones sin ver cuánto se cobra.)

### 5.3 Roles sugeridos (seed, editables)

| Rol | Permisos |
|---|---|
| Administrador | Todo (sistema) |
| Comercial | clientes/obras/presupuestos/documentos/agenda/anexos: L-E, `cambiar_estado`, `emitir`, `ver_montos`; cobros L-E; finanzas L |
| Operario | presupuestos L (asignados); campo L-E (asignados); agenda L (asignados); anexos L-E (asignados); gastos L-E (asignados); stock L |
| Administración | stock/gastos/cobros L-E-D; finanzas L; presupuestos L + `ver_montos` |

### 5.4 Asignación
Un presupuesto tiene una lista de **usuarios asignados** (con rol en el trabajo: responsable, operario). La asignación determina el alcance `asignados` y quién recibe las notificaciones (ver `09-notificaciones.md`).

### 5.5 Aplicación
- La verificación de permisos se hace **en `services/`**, nunca solo en la UI. La UI oculta lo que no se puede usar (UX) pero el servidor es la fuente de verdad.
- Las consultas de listados se filtran por alcance en SQL (no se filtra en memoria).
- MCP usa exactamente los mismos permisos del usuario dueño del token, **sin** `eliminar` (ver `11-mcp.md`).

## 6. Auditoría

**RF-AUD-01 [M]** Se registra toda escritura (crear, editar, eliminar, cambio de estado, emitir, login, logout, fallos de login, cambios de permisos, uso de tokens MCP):

| Campo | Ejemplo |
|---|---|
| `at` | 2026-10-08T14:03:11-03:00 |
| `actor_user_id` | u_123 |
| `source` | `ui` \| `mcp` \| `cron` \| `system` |
| `action` | `presupuesto.estado.cambiar` |
| `entity_type` / `entity_id` | `presupuesto` / `2026/0105` |
| `diff` | JSON `{campo: [antes, después]}` |
| `ip`, `user_agent` | |

**RF-AUD-02 [M]** Solo lectura, sin posibilidad de edición ni eliminación (ni para el admin). Filtros por usuario, entidad, acción, origen y rango de fechas.
**RF-AUD-03 [M]** En cada presupuesto, la tab "Historial" muestra la auditoría filtrada de esa entidad y sus hijos.
**RF-AUD-04 [S]** Exportar a CSV.

## 7. Criterios de aceptación
- [ ] Un admin recién creado no puede acceder a ninguna pantalla hasta completar los 4 pasos del asistente.
- [ ] Sin email validado no se completa el asistente.
- [ ] Un operario con `presupuestos.leer (asignados)` no ve, ni por URL ni por MCP, un presupuesto al que no está asignado (403).
- [ ] Sin `ver_montos`, ningún endpoint ni tool MCP devuelve importes.
- [ ] No se puede desactivar al último admin.
- [ ] Cada cambio de estado aparece en la auditoría con el diff y el origen.
