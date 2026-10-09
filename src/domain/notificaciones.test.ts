import { describe, expect, it } from "vitest";
import { canales, tituloAgrupado } from "./notificaciones";

describe("notificaciones", () => {
  it("canales por defecto del evento", () => {
    expect(canales("asignacion", null)).toEqual(["push", "email"]);
    expect(canales("cobro_registrado", {})).toEqual([]);
  });

  it("las preferencias por categoría pisan los valores por defecto", () => {
    expect(canales("asignacion", { presupuestos: { email: false } })).toEqual(["push"]);
    expect(canales("cobro_registrado", { cobros: { email: true } })).toEqual(["email"]);
  });

  it("título agrupado", () => {
    expect(tituloAgrupado("Nuevo registro de campo", 1)).toBe("Nuevo registro de campo");
    expect(tituloAgrupado("Nuevo registro de campo", 3)).toBe("(3) Nuevo registro de campo");
  });
});
