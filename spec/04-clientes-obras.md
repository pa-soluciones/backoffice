# 04 — Clientes, directores de obra, obras, explorador y buscador

## 1. Jerarquía

```
Cliente (contratista)            ← carpeta
└── Obra (dirección)             ← carpeta
    ├── Presupuesto 2026/0105    ← carpeta
    │   ├── Presupuesto (R0, R1…)
    │   ├── Adicionales (AD1, AD2…) + sus certificaciones
    │   ├── Certificaciones (C1, C2…)
    │   ├── Control de perforaciones (CP1…)
    │   ├── Anexos
    │   └── Stock y gastos · Cobros
    ├── Presupuesto 2026/0131
    └── Reportes mensuales (por mes)   ← a nivel obra
"Sin cliente"                    ← carpeta virtual con prospectos anónimos
```

## 2. Cliente

**RF-CLI-01 [M]** Campos: **razón social** (obligatorio, única sin distinguir mayúsculas ni acentos). Opcionales: CUIT (validado con dígito verificador si se carga), teléfono, email, notas.
**RF-CLI-02 [S]** Contactos opcionales (nombre, cargo, teléfono, email), 0..n.
**RF-CLI-03 [M]** No se puede eliminar un cliente con obras o presupuestos; se puede **archivar** (se oculta de listados por defecto).
**RF-CLI-04 [M]** Al tipear la razón social se sugieren clientes similares (trigram) para evitar duplicados ("Constructora Ejemplo" vs "CONSTRUCTORA EJEMPLO SRL").
**RF-CLI-05 [S]** Fusionar dos clientes duplicados (mueve obras y presupuestos; solo admin; auditado).

## 3. Director de Obra

**RF-DIR-01 [M]** Entidad reutilizable: nombre y apellido (obligatorio), teléfono, email, empresa/estudio (opcional), notas.
**RF-DIR-02 [M]** Se asigna a la obra (uno por obra; se puede cambiar). El documento toma el director vigente **al momento de emitir** y lo congela en el snapshot.
**RF-DIR-03 [M]** Vista del director: todas las obras en las que participa (con cualquier cliente).

## 4. Obra

**RF-OBR-01 [M]** Campos: cliente (obligatorio), nombre corto opcional ("Obra Córdoba"), **dirección** (calle y número, localidad/barrio, provincia; texto como se imprime: "Av. Córdoba 1234, CABA"), director de obra, responsable de Higiene y Seguridad (nombre + imagen de firma opcional, para el Reporte Mensual), notas.
**RF-OBR-02 [S]** Coordenadas opcionales y botón "Abrir en Maps".
**RF-OBR-03 [M]** Estado resumen derivado (no editable):
- **Activa** si algún presupuesto está En progreso o Pendiente liquidación.
- **En gestión** si hay presupuestos en Prospecto / Visita técnica / En espera.
- **Cerrada** si todos están Terminado / Rechazado / Cancelado.
**RF-OBR-04 [M]** Tablero de la obra: presupuestos con estado, totales cotizados/cobrados (con `ver_montos`), últimos registros de campo, reportes mensuales.

## 5. Explorador

**RF-EXP-01 [M]** Navegación tipo explorador de archivos sobre la jerarquía de la sección 1.
**RF-EXP-02 [M]** Cada carpeta muestra: nombre, contador de hijos, badge de estado (presupuestos), fecha de última actividad.
**RF-EXP-03 [M]** Ordenar por nombre / última actividad / ID; filtrar por estado y por "solo asignados a mí".
**RF-EXP-04 [M]** Dentro de un presupuesto, los documentos se listan con: tipo, código (`2026/0105-AD1`), versión, estado (borrador/emitido), fecha, emitido por, y acciones (ver, descargar DOCX, descargar PDF, nueva versión).
**RF-EXP-05 [M]** Respeta permisos y alcance: un usuario con alcance `asignados` solo ve los clientes y obras que contienen presupuestos asignados a él.
**RF-EXP-06 [S]** Acciones rápidas desde el explorador: "+ Obra" en un cliente, "+ Presupuesto" en una obra, mover un prospecto de "Sin cliente" a un cliente/obra (arrastrar en desktop, menú en mobile).

## 6. Buscador global

**RF-BUS-01 [M]** Barra en el topbar (`Ctrl/⌘+K`), con resultados agrupados por tipo: Presupuestos · Clientes · Obras · Directores · Documentos.
**RF-BUS-02 [M]** Busca por:
- **ID**: `2026/0105`, `0105`, `105`, `2026/105`, `2026/0105-AD1`, `AD1` (dentro del contexto).
- **Dirección** de obra.
- **Nombre del director de obra.**
- **Razón social del contratista (cliente).**
- Nombre/teléfono del contacto de un prospecto anónimo.
**RF-BUS-03 [M]** Insensible a mayúsculas y acentos (`unaccent`) y tolerante a errores de tipeo (`pg_trgm`, similitud ≥ 0,3). "cordoba" encuentra "Av. Córdoba 1234".
**RF-BUS-04 [M]** Resultados en < 300 ms para 10.000 presupuestos (índices GIN trigram).
**RF-BUS-05 [M]** Los resultados respetan permisos y alcance.
**RF-BUS-06 [S]** Búsqueda avanzada (pantalla de presupuestos): filtros combinables por estado, cliente, director, rango de fechas, moneda, bonificado, usuario asignado y año.

## 7. Criterios de aceptación
- [ ] Crear "CONSTRUCTORA EJEMPLO SRL" cuando existe "Constructora Ejemplo" muestra la sugerencia de posible duplicado.
- [ ] Buscar "105" devuelve `2026/0105` (y `2025/0105` si existe), ordenados por año descendente.
- [ ] Buscar "gomez" devuelve el director y sus obras.
- [ ] En mobile, el explorador navega de cliente → obra → presupuesto → documento sin scroll horizontal.
