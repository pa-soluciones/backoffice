import { describe, expect, it } from "vitest";
import { cuitValido, formatearCuit } from "./cuit";

describe("cuitValido", () => {
  it("acepta CUIT válidos con o sin guiones", () => {
    expect(cuitValido("20-12345678-6")).toBe(true);
    expect(cuitValido("20123456786")).toBe(true);
    expect(cuitValido("30-50001091-2")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(cuitValido("20-12345678-5")).toBe(false);
  });

  it("rechaza largo incorrecto", () => {
    expect(cuitValido("20-1234567-6")).toBe(false);
    expect(cuitValido("")).toBe(false);
  });

  it("verificador calculado 10 es inválido", () => {
    // 20-00000001-? : suma = 2*5 + 1*2 = 12 → 11 - 1 = 10 → inválido; 20-00000002: suma 14 → 8.
    expect(cuitValido("20-00000002-8")).toBe(true);
    expect(cuitValido("20-00000001-0")).toBe(false);
  });
});

describe("formatearCuit", () => {
  it("agrega guiones", () => {
    expect(formatearCuit("20123456786")).toBe("20-12345678-6");
  });
});
