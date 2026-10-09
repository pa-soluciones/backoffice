import { describe, expect, it } from "vitest";
import { anioArgentina, codigoPresupuesto, codigoRevision, parsearCodigo } from "./codigos";
import { descripcionAuto } from "./items";
import { anticipo, calcularTotales, formatearMonto } from "./montos";
import { destinos, validarTransicion, type Contexto } from "./workflow";

describe("códigos", () => {
  it("formatea con 4 dígitos y crece sin cortar", () => {
    expect(codigoPresupuesto(2026, 105)).toBe("2026/0105");
    expect(codigoPresupuesto(2026, 12345)).toBe("2026/12345");
    expect(codigoRevision("2026/0105", 0)).toBe("2026/0105");
    expect(codigoRevision("2026/0105", 2)).toBe("2026/0105 R2");
  });

  it("interpreta lo que se tipea en el buscador", () => {
    expect(parsearCodigo("2026/0105")).toEqual({ anio: 2026, numero: 105 });
    expect(parsearCodigo("2026/105")).toEqual({ anio: 2026, numero: 105 });
    expect(parsearCodigo("105")).toEqual({ numero: 105 });
    expect(parsearCodigo("Córdoba")).toBeNull();
  });

  it("el año es el de Argentina, no UTC", () => {
    // 1/1/2027 01:00 UTC = 31/12/2026 22:00 en Buenos Aires.
    expect(anioArgentina(new Date("2027-01-01T01:00:00Z"))).toBe(2026);
  });
});

describe("calcularTotales", () => {
  const sinNada = { bonificacion: null, incluyeIva: false, ivaPct: 21 };

  it("template de presupuesto: 9 × $168.000 = $1.512.000", () => {
    const t = calcularTotales([{ cantidad: 9, precioUnitario: 168000 }], sinNada);
    expect(t.neto).toBe(1512000);
    expect(t.total).toBe(1512000);
  });

  it("bonificación % se aplica al precio unitario (template de certificación)", () => {
    // 16 × Ø102 y 8 × Ø152 con valores de lista que bonificados dan 128.750 y 118.750.
    const t = calcularTotales(
      [
        { cantidad: 16, precioUnitario: 137500 },
        { cantidad: 8, precioUnitario: 126822.06 },
      ],
      { ...sinNada, bonificacion: { tipo: "pct", valor: 6.363636 } },
    );
    expect(t.lineas[0].precioUnitario).toBe(128750);
    expect(t.lineas[0].subtotal).toBe(2060000);
    expect(t.bonificacionMonto).toBe(0);
  });

  it("bonificación de monto fijo va como línea aparte y no deja negativo", () => {
    const t = calcularTotales([{ cantidad: 1, precioUnitario: 1000 }], { ...sinNada, bonificacion: { tipo: "monto", valor: 100 } });
    expect(t.subtotal).toBe(1000);
    expect(t.bonificacionMonto).toBe(100);
    expect(t.neto).toBe(900);
    const tope = calcularTotales([{ cantidad: 1, precioUnitario: 50 }], { ...sinNada, bonificacion: { tipo: "monto", valor: 100 } });
    expect(tope.neto).toBe(0);
  });

  it("IVA solo si se pide", () => {
    const t = calcularTotales([{ cantidad: 1, precioUnitario: 1000 }], { ...sinNada, incluyeIva: true });
    expect(t.iva).toBe(210);
    expect(t.total).toBe(1210);
  });

  it("redondeo por línea sin errores de coma flotante", () => {
    const t = calcularTotales([{ cantidad: 3, precioUnitario: 0.1 }], sinNada);
    expect(t.neto).toBe(0.3);
    expect(calcularTotales([{ cantidad: 1.5, precioUnitario: 33.33 }], sinNada).neto).toBe(50);
  });

  it("anticipo 40% de $3.010.000 = $1.204.000", () => {
    expect(anticipo(3010000, 40)).toBe(1204000);
  });

  it("formato es-AR", () => {
    expect(formatearMonto(1512000)).toBe("$ 1.512.000,00");
    expect(formatearMonto(1250, "USD")).toBe("US$ 1.250,00");
  });
});

describe("descripcionAuto", () => {
  it("como en el template", () => {
    expect(descripcionAuto({ tipoServicio: "perforacion", elemento: "Viga", diametroMm: 152, espesorCm: 29, unidad: "u" })).toBe(
      "Perforaciones en viga, 152mm x 29cm de espesor",
    );
    expect(descripcionAuto({ tipoServicio: "mano_obra", elemento: null, diametroMm: null, espesorCm: null, unidad: "h" })).toBe(
      "Mano de obra",
    );
  });
});

describe("workflow", () => {
  const base: Contexto = { requiereVisita: false, visitaResuelta: false, tieneEmitida: false };

  it("sin presupuesto emitido no pasa a En espera", () => {
    expect(validarTransicion("prospecto", "en_espera", base)).toMatch(/Emití/);
    expect(validarTransicion("prospecto", "en_espera", { ...base, tieneEmitida: true })).toBeNull();
  });

  it("con visita requerida, pasa por Visita técnica y necesita resolverla", () => {
    const c = { ...base, requiereVisita: true, tieneEmitida: true };
    expect(validarTransicion("prospecto", "en_espera", c)).toMatch(/visita técnica/);
    expect(validarTransicion("prospecto", "visita_tecnica", c)).toBeNull();
    expect(validarTransicion("visita_tecnica", "en_espera", c)).toMatch(/realizada u omitida/);
    expect(validarTransicion("visita_tecnica", "en_espera", { ...c, visitaResuelta: true })).toBeNull();
  });

  it("no pasa a Pendiente liquidación sin cierre de materiales (spec/08)", () => {
    expect(validarTransicion("en_progreso", "pendiente_liquidacion", { ...base, materialesSinCerrar: 2 })).toMatch(/cierre de materiales/);
    expect(validarTransicion("en_progreso", "pendiente_liquidacion", { ...base, materialesSinCerrar: 0 })).toBeNull();
  });

  it("confirmación exige fecha; rechazo y cancelación exigen motivo", () => {
    expect(validarTransicion("en_espera", "en_progreso", base)).toMatch(/fecha/);
    expect(validarTransicion("en_espera", "en_progreso", { ...base, fechaConfirmacion: "2026-10-09" })).toBeNull();
    expect(validarTransicion("en_espera", "rechazado", base)).toMatch(/motivo/);
    expect(validarTransicion("en_progreso", "cancelado", { ...base, motivo: "Obra suspendida" })).toBeNull();
  });

  it("terminado: automático sin saldo, manual con motivo", () => {
    expect(validarTransicion("pendiente_liquidacion", "terminado", { ...base, saldoPendiente: 0 })).toBeNull();
    expect(validarTransicion("pendiente_liquidacion", "terminado", { ...base, saldoPendiente: 100 })).toMatch(/saldo/);
    expect(validarTransicion("pendiente_liquidacion", "terminado", { ...base, saldoPendiente: 100, motivo: "Condonado" })).toBeNull();
  });

  it("estados finales no se mueven; saltos inválidos se rechazan", () => {
    expect(destinos("terminado")).toEqual([]);
    expect(validarTransicion("cancelado", "cancelado", { ...base, motivo: "x" })).toMatch(/cerrado/);
    expect(validarTransicion("prospecto", "terminado", base)).toMatch(/No se puede/);
    expect(destinos("en_espera")).toEqual(["en_progreso", "rechazado", "cancelado"]);
  });
});
