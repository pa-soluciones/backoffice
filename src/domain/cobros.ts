// Cobros (spec/08 §3): estado de cada cobro esperado y saldo por cobrar. Sin DB, en centavos.

import type { Moneda } from "./montos";

export const CONCEPTOS = { anticipo: "Anticipo", saldo: "Saldo", adicional: "Adicional", otro: "Otro" } as const;
export type Concepto = keyof typeof CONCEPTOS;
export const MEDIOS = { transferencia: "Transferencia", efectivo: "Efectivo", cheque: "Cheque", echeq: "E-cheq", otro: "Otro" } as const;
export type Medio = keyof typeof MEDIOS;
export const ESTADOS_COBRO = { pendiente: "PENDIENTE", parcial: "PARCIAL", abonado: "ABONADO" } as const;
export type EstadoCobro = keyof typeof ESTADOS_COBRO;

const c = (n: number) => Math.round((n + Number.EPSILON) * 100);

export function estadoCobro(esperado: number, imputado: number): EstadoCobro {
  if (c(imputado) <= 0) return "pendiente";
  return c(imputado) >= c(esperado) ? "abonado" : "parcial";
}

/**
 * Importe a imputar en la moneda del presupuesto (RF-COB-06). El tipo de cambio es siempre
 * pesos por dólar: pagar US$ 100 a 1.000 un presupuesto en pesos imputa $ 100.000.
 */
export function importeImputado(importe: number, recibida: Moneda, moneda: Moneda, tipoCambio: number | null): number {
  if (recibida === moneda) return importe;
  if (!tipoCambio || tipoCambio <= 0) throw new Error("Falta el tipo de cambio.");
  return Math.round((recibida === "USD" ? importe * tipoCambio : importe / tipoCambio) * 100) / 100;
}

/** Saldo por cobrar: lo esperado menos lo imputado, por cobro (un pago de más no compensa otro concepto). */
export function porCobrar(esperados: { importe: number; imputado: number }[]) {
  return esperados.reduce((s, e) => s + Math.max(0, c(e.importe) - c(e.imputado)), 0) / 100;
}

/** % del total redondeado a centavos. */
export const porcentaje = (total: number, pct: number) => Math.round((c(total) * pct) / 100) / 100;
