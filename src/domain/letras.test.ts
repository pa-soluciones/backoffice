import { describe, expect, it } from "vitest";
import { enteroEnLetras, montoEnLetras } from "./letras";

describe("montos en letras", () => {
  it("ejemplo del Word de certificación", () => {
    expect(montoEnLetras(2_836_000, "ARS")).toBe("PESOS DOS MILLONES OCHOCIENTOS TREINTA Y SEIS MIL CON 00/100");
  });

  it("casos borde del castellano", () => {
    expect(enteroEnLetras(0)).toBe("CERO");
    expect(enteroEnLetras(1)).toBe("UNO");
    expect(enteroEnLetras(100)).toBe("CIEN");
    expect(enteroEnLetras(101)).toBe("CIENTO UNO");
    expect(enteroEnLetras(16)).toBe("DIECISÉIS");
    expect(enteroEnLetras(22)).toBe("VEINTIDÓS");
    expect(enteroEnLetras(1000)).toBe("MIL");
    expect(enteroEnLetras(21_000)).toBe("VEINTIÚN MIL");
    expect(enteroEnLetras(31_000)).toBe("TREINTA Y UN MIL");
    expect(enteroEnLetras(100_000)).toBe("CIEN MIL");
    expect(enteroEnLetras(1_000_000)).toBe("UN MILLÓN");
    expect(enteroEnLetras(21_000_000)).toBe("VEINTIÚN MILLONES");
    expect(enteroEnLetras(1_001_001)).toBe("UN MILLÓN MIL UNO");
    expect(enteroEnLetras(1_000_000_000)).toBe("MIL MILLONES");
  });

  it("centavos y dólares", () => {
    expect(montoEnLetras(1250.5, "USD")).toBe("DÓLARES ESTADOUNIDENSES MIL DOSCIENTOS CINCUENTA CON 50/100");
    expect(montoEnLetras(0.99, "ARS")).toBe("PESOS CERO CON 99/100");
  });
});
