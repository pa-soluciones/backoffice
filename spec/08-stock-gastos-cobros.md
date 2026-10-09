# 08 — Stock, compras, gastos, cobros y resumen económico

## 1. Stock (inventario general)

### 1.1 Artículos
**RF-STK-01 [M]** Catálogo de artículos: nombre, categoría (Corona diamantada, Disco, Hilo diamantado, Insumo, Consumible, EPP, Herramienta, Repuesto, Otro), unidad (u, m, l, kg, caja), atributos opcionales (Ø, marca, modelo), stock mínimo opcional, notas, foto opcional.
**RF-STK-02 [M]** Costo unitario = **promedio ponderado** en ARS, recalculado en cada compra al depósito. Las compras en USD se convierten con el tipo de cambio cargado en la compra.

### 1.2 Ubicaciones
- **Depósito** (único en v1).
- **Presupuesto** (cada presupuesto En progreso actúa como ubicación: lo que está "en obra").

### 1.3 Movimientos

| Tipo | Desde → Hacia | Efecto en costos |
|---|---|---|
| `compra` | proveedor → depósito **o** → presupuesto (compra directa para la obra) | Si va a presupuesto: egreso del presupuesto |
| `asignacion` | depósito → presupuesto | — (se valoriza al consumir) |
| `devolucion` | presupuesto → depósito | — |
| `consumo` | presupuesto → (consumido) | Egreso del presupuesto: cantidad × costo promedio |
| `ajuste` | depósito ± | Motivo obligatorio (inventario, rotura, pérdida) |
| `baja` | depósito → (baja) | Motivo obligatorio |

**RF-STK-03 [M]** El stock por ubicación se calcula como suma de movimientos (no se guarda un número editable). No se permite stock negativo en el depósito (error claro).
**RF-STK-04 [M]** Desde el presupuesto: "Asignar materiales" (multi-selección del depósito) y "Registrar consumo" (también offline).
**RF-STK-05 [M]** **Cierre de materiales** (obligatorio para pasar a Pendiente liquidación): lista de todo lo asignado/comprado para el presupuesto con su saldo; por cada línea el usuario indica **cuánto se consumió** y **cuánto vuelve al depósito** (debe sumar el saldo). Las herramientas con desgaste (coronas) pueden volver con nota de estado ("vida restante aprox.").
**RF-STK-06 [M]** Alerta de stock bajo mínimo (notificación diaria, ver `09`).
**RF-STK-07 [S]** Historial de movimientos por artículo con filtros.

### 1.4 Compras
**RF-COM-01 [M]** Registrar compra: fecha, destino (depósito o presupuesto), líneas (artículo existente o nuevo inline, cantidad, precio unitario), moneda, tipo de cambio (si USD), total.
**RF-COM-02 [M]** **Proveedor: opcional.** Seleccionar uno existente o crearlo inline (nombre obligatorio; CUIT, teléfono, email opcionales).
**RF-COM-03 [M]** **Comprobante (factura/ticket): opcional.** Foto o PDF, mismo pipeline que los anexos.

## 2. Gastos (egresos que no son stock)

**RF-GAS-01 [M]** Registrar gasto: fecha, presupuesto (o "general de empresa"), categoría, descripción, importe, moneda, tipo de cambio (si USD), proveedor opcional, comprobante opcional.
**Categorías (editables en Ajustes):** Mano de obra, Viáticos, Combustible, Peajes/estacionamiento, Alquiler de equipos, Flete, Comida, Otros.
**RF-GAS-02 [M]** Carga rápida mobile y **offline** (ej. el operario carga el combustible desde la obra).
**RF-GAS-03 [M]** Gastos generales (sin presupuesto) cuentan en el resumen de empresa, no en el de un presupuesto.

## 3. Cobros (ingresos)

**RF-COB-01 [M]** Cobros esperados se generan automáticamente:
- Al pasar a **En progreso**: `Anticipo` = `anticipo_pct` × total neto vigente.
- Al pasar a **Pendiente liquidación**: `Saldo` = total certificado (presupuesto + adicionales aprobados) − cobros recibidos.
- Al aprobar un **adicional**: su anticipo (si `anticipo_pct > 0`) y su saldo.
**RF-COB-02 [M]** Registrar cobro recibido: fecha, concepto (anticipo / saldo / adicional ADn / otro), importe, moneda, medio de pago (transferencia, efectivo, cheque, e-cheq, otro), referencia, comprobante opcional. Se imputa a un cobro esperado (puede ser parcial).
**RF-COB-03 [M]** Estado por cobro esperado: `pendiente` | `parcial` | `abonado`. Este estado alimenta la tabla "Situación de pagos" de las certificaciones.
**RF-COB-04 [M]** Vista del presupuesto: anticipo (¿cuándo se pagó?), saldo (¿cuándo se pagó?), adicionales, total cobrado, saldo por cobrar.
**RF-COB-05 [M]** Cuando el saldo por cobrar llega a 0 en Pendiente liquidación → transición automática a **Terminado** (ver `05`).
**RF-COB-06 [M]** Si el cliente paga en otra moneda que la del presupuesto: se registra la moneda recibida y el tipo de cambio aplicado; la imputación se hace en la moneda del presupuesto.

## 4. Resumen económico

**RF-RES-01 [M]** Por presupuesto (tab "Resumen económico", requiere `ver_montos`):

| Ingresos | Egresos |
|---|---|
| Total presupuestado (vigente) | Materiales consumidos (valorizados a costo promedio) |
| + Adicionales aprobados | + Compras directas al presupuesto (no devueltas) |
| = Total a cobrar | + Gastos del presupuesto por categoría |
| Cobrado / Pendiente | = Total egresos |

**Resultado** = total a cobrar − total egresos, y **margen %**. Mientras está en curso es "proyectado"; al pasar a Terminado se **congela** un snapshot del resumen.
**RF-RES-02 [M]** Moneda del resumen = moneda del presupuesto; egresos en otra moneda se convierten con el tipo de cambio de cada movimiento.
**RF-RES-03 [M]** Finanzas (empresa): por período (mes/trimestre/año) → ingresos cobrados, egresos, resultado; ranking de presupuestos por margen; cobros pendientes (aging: 0–30, 31–60, > 60 días); gastos por categoría. Gráficos simples (barras/línea).
**RF-RES-04 [S]** Exportar resúmenes a CSV/XLSX.

## 5. Criterios de aceptación
- [ ] Comprar 10 coronas a $100 y 10 a $200 → costo promedio $150.
- [ ] No se puede pasar a Pendiente liquidación sin completar el cierre de materiales.
- [ ] En el cierre, asignado 5, consumido 3 → devuelve 2 al depósito y el egreso es 3 × costo promedio.
- [ ] Un presupuesto de $3.010.000 con anticipo 40% genera un cobro esperado de $1.204.000 al pasar a En progreso.
- [ ] Registrar compra sin proveedor ni comprobante es válido.
