// Resumen económico (spec/08 §4). Sin DB.

export type EntradaResumen = {
  moneda: "ARS" | "USD";
  presupuestado: number;
  adicionales: number;
  cobrado: number;
  /** En ARS. */
  materialesArs: number;
  /** En ARS, por categoría. */
  gastosArs: { categoria: string; importe: number }[];
  /** Pesos por dólar para llevar los egresos a la moneda de un presupuesto en dólares (null = no hay). */
  tipoCambio: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function resumenEconomico(e: EntradaResumen) {
  const aMoneda = (ars: number) => (e.moneda === "ARS" ? ars : e.tipoCambio ? r2(ars / e.tipoCambio) : null);
  const totalACobrar = r2(e.presupuestado + e.adicionales);
  const gastosArs = r2(e.gastosArs.reduce((s, g) => s + g.importe, 0));
  const egresosArs = r2(e.materialesArs + gastosArs);
  const egresos = aMoneda(egresosArs);
  const resultado = egresos == null ? null : r2(totalACobrar - egresos);
  return {
    moneda: e.moneda,
    ingresos: { presupuestado: e.presupuestado, adicionales: e.adicionales, totalACobrar, cobrado: r2(e.cobrado), pendiente: r2(Math.max(0, totalACobrar - e.cobrado)) },
    egresos: {
      materiales: aMoneda(e.materialesArs),
      gastos: e.gastosArs.map((g) => ({ categoria: g.categoria, importe: aMoneda(g.importe) })),
      total: egresos,
      totalArs: egresosArs,
    },
    resultado,
    margen: resultado == null || totalACobrar === 0 ? null : Math.round((resultado / totalACobrar) * 1000) / 10,
    tipoCambio: e.tipoCambio,
  };
}

export type Resumen = ReturnType<typeof resumenEconomico>;

/** Antigüedad de lo pendiente de cobro (RF-RES-03). */
export function tramoAntiguedad(dias: number): "0-30" | "31-60" | "60+" {
  return dias <= 30 ? "0-30" : dias <= 60 ? "31-60" : "60+";
}
