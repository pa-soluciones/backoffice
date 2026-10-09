import { describe, expect, it } from "vitest";
import { estadoCobro, importeImputado, porcentaje, porCobrar } from "./cobros";

describe("cobros", () => {
  it("estado por lo imputado", () => {
    expect(estadoCobro(1000, 0)).toBe("pendiente");
    expect(estadoCobro(1000, 400)).toBe("parcial");
    expect(estadoCobro(1000, 1000)).toBe("abonado");
    expect(estadoCobro(1000, 1000.004)).toBe("abonado");
  });

  it("otra moneda con tipo de cambio en pesos por dólar", () => {
    expect(importeImputado(100, "USD", "ARS", 1000)).toBe(100_000);
    expect(importeImputado(150_000, "ARS", "USD", 1200)).toBe(125);
    expect(importeImputado(500, "ARS", "ARS", null)).toBe(500);
    expect(() => importeImputado(1, "USD", "ARS", null)).toThrow();
  });

  it("saldo por cobrar sin compensar conceptos", () => {
    expect(porCobrar([{ importe: 400, imputado: 400 }, { importe: 600, imputado: 100 }])).toBe(500);
    expect(porCobrar([{ importe: 400, imputado: 500 }, { importe: 600, imputado: 0 }])).toBe(600);
  });

  it("anticipo del 40%", () => {
    expect(porcentaje(1_000_000, 40)).toBe(400_000);
    expect(porcentaje(333.33, 40)).toBe(133.33);
  });
});
