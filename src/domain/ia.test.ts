import { describe, expect, it } from "vitest";
import { cifrasNuevas, costoUsd } from "./ia";

describe("ia", () => {
  it("costo por modelo", () => {
    expect(costoUsd("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(costoUsd("claude-haiku-5-5", 1500, 300)).toBeCloseTo(0.0003, 6);
    // Modelo desconocido: se estima con el default (cota superior).
    expect(costoUsd("otro", 0, 1_000_000)).toBe(20);
  });

  it("detecta cifras inventadas, ignora las que ya estaban", () => {
    const conocido = "9 perforaciones de Ø 152 mm en vigas de 29 cm. Total $ 1.512.000,00";
    expect(cifrasNuevas("Se realizarán 9 perforaciones de 152 mm.", conocido)).toEqual([]);
    expect(cifrasNuevas("Total 1512000,00 en 29 cm", conocido)).toEqual([]);
    expect(cifrasNuevas("Se harán 12 perforaciones en 3 días.", conocido)).toEqual(["12", "3"]);
  });
});
