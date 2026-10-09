import { describe, expect, it } from "vitest";
import { resumenEconomico, tramoAntiguedad } from "./resumen";

describe("resumen económico", () => {
  it("ingresos, egresos por categoría, resultado y margen", () => {
    const r = resumenEconomico({
      moneda: "ARS",
      presupuestado: 1_512_000,
      adicionales: 488_000,
      cobrado: 604_800,
      materialesArs: 450,
      gastosArs: [
        { categoria: "Combustible", importe: 45_000 },
        { categoria: "Viáticos", importe: 4_550 },
      ],
      tipoCambio: null,
    });
    expect(r.ingresos).toEqual({ presupuestado: 1_512_000, adicionales: 488_000, totalACobrar: 2_000_000, cobrado: 604_800, pendiente: 1_395_200 });
    expect(r.egresos.total).toBe(50_000);
    expect(r.resultado).toBe(1_950_000);
    expect(r.margen).toBe(97.5);
  });

  it("presupuesto en dólares: egresos convertidos o sin resultado si no hay tipo de cambio", () => {
    const base = { moneda: "USD" as const, presupuestado: 1000, adicionales: 0, cobrado: 0, materialesArs: 120_000, gastosArs: [], tipoCambio: 1200 };
    expect(resumenEconomico(base).egresos.total).toBe(100);
    expect(resumenEconomico(base).resultado).toBe(900);
    expect(resumenEconomico({ ...base, tipoCambio: null }).resultado).toBeNull();
  });

  it("antigüedad", () => {
    expect([0, 30, 31, 60, 61].map(tramoAntiguedad)).toEqual(["0-30", "0-30", "31-60", "31-60", "60+"]);
  });
});
