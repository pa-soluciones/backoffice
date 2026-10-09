# 11 — Servidor MCP

Permite que una IA externa (inicialmente **Claude Desktop**; cualquier cliente MCP) consulte y opere la aplicación en nombre de un usuario.

## 1. Transporte y autenticación

**RF-MCP-01 [M]** Endpoint remoto `https://<app>/api/mcp`, transporte **Streamable HTTP** (adaptador `mcp-handler`).
**RF-MCP-02 [M]** Auth: **token personal** `Authorization: Bearer pas_…`.
- El usuario lo crea en Perfil → Integraciones MCP (permiso `mcp.escribir`): nombre ("Claude Desktop notebook"), vencimiento (30/90/365 días), se muestra una sola vez.
- En DB se guarda solo el hash (SHA-256) + últimos 4 caracteres.
- Revocable; se revoca automáticamente al desactivar el usuario.
- Registro de último uso (fecha, IP).
**RF-MCP-03 [M]** Permisos efectivos del token = permisos del usuario **menos `eliminar`** (D13). Alcance (`todos`/`asignados`) y `ver_montos` se respetan igual que en la UI.
**RF-MCP-04 [M]** Rate limit: 60 llamadas/min por token.
**RF-MCP-05 [C]** OAuth 2.1 (para agregar como "conector personalizado" en Claude sin `mcp-remote`).

Configuración en Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "pas-backoffice": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<app>/api/mcp",
               "--header", "Authorization: Bearer ${PAS_TOKEN}"],
      "env": { "PAS_TOKEN": "pas_xxxxxxxx" }
    }
  }
}
```
La app muestra este snippet listo para copiar al crear el token.

## 2. Reglas
**RF-MCP-06 [M]** Toda tool llama a `services/*` (la misma lógica que la UI): mismas validaciones, mismo workflow, misma numeración, misma auditoría con `source = 'mcp'` y el nombre del token.
**RF-MCP-07 [M]** **No existen tools de eliminación.** Si la IA lo intenta, no hay herramienta. Las cancelaciones de estado (`Cancelado`) sí están permitidas porque no eliminan datos.
**RF-MCP-08 [M]** Inputs validados con los mismos schemas Zod de la UI; errores devueltos en español y accionables ("No se puede pasar a En espera: no hay presupuesto emitido. Usá `emitir_documento` primero.").
**RF-MCP-09 [M]** Respuestas compactas en JSON con IDs legibles (`2026/0105`) y link a la UI.
**RF-MCP-10 [M]** Acciones de alto impacto (`emitir_documento`, `cambiar_estado` a final) requieren el parámetro `confirmar: true`; sin él, la tool devuelve un resumen de lo que haría ("dry-run").

## 3. Tools

### Consulta
| Tool | Descripción |
|---|---|
| `buscar` | Búsqueda global (ID, dirección, director, cliente) |
| `listar_clientes`, `obtener_cliente` | Con obras |
| `listar_obras`, `obtener_obra` | Con presupuestos y estado resumen |
| `listar_presupuestos` | Filtros: estado, cliente, asignado, año, bonificado, vencidos |
| `obtener_presupuesto` | Ítems, estado, historial, adicionales, documentos, cobros, balance |
| `obtener_balance_perforaciones` | Cotizado vs ejecutado |
| `obtener_resumen_economico` | Por presupuesto o por período |
| `listar_agenda` | Visitas y jornadas en un rango |
| `listar_stock`, `obtener_articulo` | Stock por ubicación |
| `obtener_documento` | Bloques de texto + datos + versiones + links de descarga |
| `listar_notificaciones` | Del usuario |

### Escritura (sin eliminar)
| Tool | Descripción |
|---|---|
| `crear_cliente`, `actualizar_cliente` | |
| `crear_director`, `actualizar_director` | |
| `crear_obra`, `actualizar_obra` | |
| `crear_prospecto` | Con o sin cliente |
| `actualizar_presupuesto` | Datos generales, bonificación, asignados |
| `guardar_items` | Reemplaza los ítems del borrador vigente |
| `cambiar_estado` | Usa el workflow; pide datos requeridos (motivo, fecha de confirmación) |
| `crear_revision`, `crear_adicional` | |
| `agendar_visita`, `actualizar_visita` | |
| `crear_documento` | Borrador de cualquier tipo |
| `editar_bloque_documento` | Reemplaza el texto de un bloque (crea versión con origen `mcp`) |
| `emitir_documento` | Requiere `confirmar: true` |
| `registrar_perforacion` | Sin fotos (las fotos se suben desde la app) |
| `registrar_compra`, `registrar_gasto`, `registrar_cobro` | |
| `mover_stock` | Asignación, devolución, consumo, ajuste |
| `cerrar_materiales` | Cierre de materiales del presupuesto |

### Prompts MCP [S]
- `resumen_semanal`: estado de presupuestos, cobros pendientes y agenda de la semana.
- `preparar_presupuesto`: guía para crear un prospecto → ítems → documento.

## 4. Criterios de aceptación
- [ ] Desde Claude Desktop: "¿qué presupuestos de Constructora Ejemplo están en espera?" devuelve la lista correcta.
- [ ] Un token de un operario no puede leer presupuestos no asignados ni ver montos.
- [ ] `emitir_documento` sin `confirmar` no emite.
- [ ] La auditoría muestra `source = mcp` y el nombre del token en cada escritura.
- [ ] Un token revocado devuelve 401 en la siguiente llamada.
