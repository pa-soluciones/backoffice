import { describe, expect, it } from "vitest";
import { interpolar, parrafosDe, runsDe, variablesDesconocidas } from "./bloques";

describe("bloques", () => {
  it("negrita con **", () => {
    expect(runsDe("**Plazo estimado de inicio:** A coordinar.")).toEqual([
      { t: "Plazo estimado de inicio:", b: true },
      { t: " A coordinar.", b: false },
    ]);
    expect(runsDe("sin formato")).toEqual([{ t: "sin formato", b: false }]);
  });

  it("una línea por párrafo, sin vacías", () => {
    expect(parrafosDe("uno\n\n**dos**\r\ntres  ")).toEqual([
      { runs: [{ t: "uno", b: false }] },
      { runs: [{ t: "dos", b: true }] },
      { runs: [{ t: "tres", b: false }] },
    ]);
  });

  it("variables", () => {
    const vars = { cliente: "Constructora Ejemplo", validez_dias: "7" };
    expect(interpolar("Estimados Sres. {cliente}: válida por {validez_dias} días.", vars)).toBe(
      "Estimados Sres. Constructora Ejemplo: válida por 7 días.",
    );
    expect(interpolar("{inventada}", vars)).toBe("{inventada}");
    expect(variablesDesconocidas("{cliente} {inventada} {inventada}", vars)).toEqual(["inventada"]);
  });
});
