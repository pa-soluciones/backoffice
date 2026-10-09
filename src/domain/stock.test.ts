import { describe, expect, it } from "vitest";
import { aPesos, costoPromedio, DEPOSITO, saldo, saldos, validarCierre, type Movimiento } from "./stock";

describe("stock", () => {
  it("criterio spec/08: 10 coronas a $100 y 10 a $200 → promedio $150", () => {
    const despuesDeLaPrimera = costoPromedio(0, 0, 10, 100);
    expect(costoPromedio(10, despuesDeLaPrimera, 10, 200)).toBe(150);
  });

  it("saldos por ubicación como suma de movimientos", () => {
    const obra = "p1";
    const movs: Movimiento[] = [
      { articuloId: "a", cantidad: 20, desde: "proveedor", hacia: DEPOSITO },
      { articuloId: "a", cantidad: 5, desde: DEPOSITO, hacia: obra },
      { articuloId: "a", cantidad: 3, desde: obra, hacia: "consumido" },
      { articuloId: "a", cantidad: 2, desde: obra, hacia: DEPOSITO },
      { articuloId: "b", cantidad: 1, desde: "proveedor", hacia: obra },
    ];
    expect(saldo(movs, "a", DEPOSITO)).toBe(17);
    expect(saldo(movs, "a", obra)).toBe(0);
    expect(saldos(movs, obra)).toEqual({ b: 1 });
  });

  it("cierre: asignado 5, consumido 3 → devuelve 2", () => {
    expect(validarCierre([{ articulo: "Corona 102", saldo: 5, consumido: 3, devuelto: 2 }])).toBeNull();
    expect(validarCierre([{ articulo: "Corona 102", saldo: 5, consumido: 3, devuelto: 1 }])).toBe("Corona 102: consumido + devuelto tiene que sumar 5.");
  });

  it("compras en dólares a pesos", () => {
    expect(aPesos(100, "USD", 1200)).toBe(120_000);
    expect(aPesos(100, "ARS", null)).toBe(100);
  });
});
