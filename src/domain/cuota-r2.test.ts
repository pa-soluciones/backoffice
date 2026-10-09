import { describe, expect, it } from "vitest";
import { costoEstimado, excedidos, FREE_TIER, LIMITES_BASE, limites, mesFacturacion } from "./cuota-r2";

const cero = { almacenamiento: 0, opsA: 0, opsB: 0 };

describe("cuota R2", () => {
  it("límites base al 80% del free tier", () => {
    expect(LIMITES_BASE.opsA).toBe(800_000);
    expect(LIMITES_BASE.opsB).toBe(8_000_000);
    expect(LIMITES_BASE.almacenamiento).toBe(Math.floor(10 * 1024 ** 3 * 0.8));
  });

  it("permite mientras no se pase del límite", () => {
    expect(excedidos({ ...cero, opsA: 799_999 }, { opsA: 1 }, LIMITES_BASE)).toEqual([]);
    expect(excedidos({ ...cero, opsA: 800_000 }, { opsA: 1 }, LIMITES_BASE)).toEqual(["opsA"]);
  });

  it("un archivo que no entra en el almacenamiento se bloquea", () => {
    const usado = { ...cero, almacenamiento: LIMITES_BASE.almacenamiento - 1000 };
    expect(excedidos(usado, { almacenamiento: 2000, opsA: 1 }, LIMITES_BASE)).toEqual(["almacenamiento"]);
  });

  it("solo controla lo que la operación consume", () => {
    const lleno = { almacenamiento: LIMITES_BASE.almacenamiento, opsA: 0, opsB: 0 };
    // Una lectura no agrega almacenamiento: se permite aunque el almacenamiento esté al tope.
    expect(excedidos(lleno, { opsB: 1 }, LIMITES_BASE)).toEqual([]);
  });

  it("la aprobación del admin sube el límite, nunca lo baja", () => {
    expect(limites({ opsA: 2_000_000 }).opsA).toBe(2_000_000);
    expect(limites({ opsA: 10 }).opsA).toBe(800_000);
    expect(excedidos({ ...cero, opsA: 900_000 }, { opsA: 1 }, limites({ opsA: 2_000_000 }))).toEqual([]);
  });

  it("costo estimado: cero dentro del free tier", () => {
    expect(costoEstimado({ almacenamiento: FREE_TIER.almacenamiento, opsA: FREE_TIER.opsA, opsB: FREE_TIER.opsB })).toBe(0);
    expect(costoEstimado({ ...cero, opsA: FREE_TIER.opsA + 1_000_000 })).toBeCloseTo(4.5);
  });

  it("mes de facturación en UTC", () => {
    expect(mesFacturacion(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(mesFacturacion(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
});

describe("formatearBytes", () => {
  it("formato es-AR", async () => {
    const { formatearBytes } = await import("./cuota-r2");
    expect(formatearBytes(10 * 1024 ** 3)).toBe("10,00 GB");
    expect(formatearBytes(1.5 * 1024 ** 2)).toBe("1,5 MB");
  });
});
