// Stock (spec/08 §1): el saldo de cada ubicación es la suma de movimientos; el costo es el
// promedio ponderado en ARS. Sin DB.

export const CATEGORIAS_ARTICULO = ["Corona diamantada", "Disco", "Hilo diamantado", "Insumo", "Consumible", "EPP", "Herramienta", "Repuesto", "Otro"] as const;
export const UNIDADES_ARTICULO = { u: "u", m: "m", l: "l", kg: "kg", caja: "caja" } as const;
export type UnidadArticulo = keyof typeof UNIDADES_ARTICULO;

export const TIPOS_MOVIMIENTO = {
  compra: "Compra",
  asignacion: "Asignación a obra",
  devolucion: "Devolución al depósito",
  consumo: "Consumo",
  ajuste: "Ajuste",
  baja: "Baja",
} as const;
export type TipoMovimiento = keyof typeof TIPOS_MOVIMIENTO;

/** Ubicaciones: el depósito, un presupuesto (su id) o un extremo externo. */
export const DEPOSITO = "deposito";
export const EXTERNOS = { proveedor: "proveedor", consumido: "consumido", baja: "baja", ajuste: "ajuste" } as const;

export type Movimiento = { articuloId: string; cantidad: number; desde: string; hacia: string };

const c = (n: number) => Math.round(n * 1000) / 1000;

/** Saldo de un artículo en una ubicación. */
export function saldo(movs: Movimiento[], articuloId: string, ubicacion: string) {
  return c(movs.reduce((s, m) => (m.articuloId !== articuloId ? s : m.hacia === ubicacion ? s + m.cantidad : m.desde === ubicacion ? s - m.cantidad : s), 0));
}

/** Saldos por artículo en una ubicación (solo los distintos de cero). */
export function saldos(movs: Movimiento[], ubicacion: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const m of movs) {
    if (m.hacia === ubicacion) r[m.articuloId] = (r[m.articuloId] ?? 0) + m.cantidad;
    if (m.desde === ubicacion) r[m.articuloId] = (r[m.articuloId] ?? 0) - m.cantidad;
  }
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, c(v)]).filter(([, v]) => v !== 0));
}

/** RF-STK-02: promedio ponderado al ingresar `cantidad` a `costo` sobre el stock existente. */
export function costoPromedio(stock: number, costoActual: number, cantidad: number, costo: number) {
  const total = stock + cantidad;
  if (total <= 0) return costo;
  return Math.round(((Math.max(0, stock) * costoActual + cantidad * costo) / (Math.max(0, stock) + cantidad)) * 100) / 100;
}

/** Precio en ARS (las compras en USD llevan su tipo de cambio). */
export const aPesos = (precio: number, moneda: "ARS" | "USD", tipoCambio: number | null) =>
  moneda === "ARS" ? precio : Math.round(precio * (tipoCambio ?? 0) * 100) / 100;

/** RF-STK-05: en el cierre, consumido + devuelto tiene que ser exactamente el saldo en obra. */
export function validarCierre(lineas: { articulo: string; saldo: number; consumido: number; devuelto: number }[]): string | null {
  for (const l of lineas) {
    if (l.consumido < 0 || l.devuelto < 0) return `${l.articulo}: las cantidades no pueden ser negativas.`;
    if (c(l.consumido + l.devuelto) !== c(l.saldo)) return `${l.articulo}: consumido + devuelto tiene que sumar ${l.saldo}.`;
  }
  return null;
}
