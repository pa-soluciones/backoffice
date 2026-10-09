import { describe, expect, it } from "vitest";
import { alturaPiso, balance, etiquetaDiferencia, rangoPisos } from "./balance";

describe("balance de perforaciones", () => {
  it("criterio spec/07 §4: 16 Ø102 + 8 Ø152 cotizadas contra los registros del template", () => {
    const pisos102 = [2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1]; // pisos 17 al 2
    const ejecutado = [...pisos102.map((cantidad) => ({ diametroMm: 102, cantidad })), { diametroMm: 152, cantidad: 1 }, { diametroMm: 152, cantidad: 2 }];
    const b = balance(
      [
        { diametroMm: 102, cantidad: 16, precioUnitario: 128750 },
        { diametroMm: 152, cantidad: 8, precioUnitario: 160000 },
      ],
      ejecutado,
    );
    expect(b.filas.map((f) => [f.diametroMm, f.cotizadas, f.ejecutadas, f.diferencia])).toEqual([
      [102, 16, 24, 8],
      [152, 8, 3, -5],
    ]);
    expect(b.totales).toEqual({ cotizadas: 24, ejecutadas: 27, diferencia: 3 });
  });

  it("diámetro ejecutado sin cotizar queda en exceso y sin precio", () => {
    const b = balance([], [{ diametroMm: 200, cantidad: 2 }]);
    expect(b.filas).toEqual([{ diametroMm: 200, cotizadas: 0, ejecutadas: 2, diferencia: 2, precioUnitario: null }]);
  });

  it("etiquetas", () => {
    expect(etiquetaDiferencia(8).texto).toBe("+8 unidades (Ejecutadas en exceso)");
    expect(etiquetaDiferencia(-1).texto).toBe("-1 unidad (Pendientes de realizar)");
    expect(etiquetaDiferencia(0)).toEqual({ texto: "Completo", tono: "completo" });
  });

  it("pisos de arriba hacia abajo", () => {
    const pisos = ["PB", "2", "SS1", "Azotea", "17", "SS2"];
    expect(pisos.sort((a, b) => alturaPiso(b) - alturaPiso(a))).toEqual(["Azotea", "17", "2", "PB", "SS1", "SS2"]);
    expect(rangoPisos(["9", "17", "2", "9"])).toBe("Pisos 17 al 2");
    expect(rangoPisos(["PB"])).toBe("Piso PB");
  });
});
