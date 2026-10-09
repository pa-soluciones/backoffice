import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { armar, bloquesPorDefecto, type DatosPresupuesto } from "@/documents/presupuesto";
import { renderDocx } from "@/documents/render";
import { calcularTotales } from "@/domain/montos";

// Datos del ejemplo del Word: 9 × Ø152 a $168.000.
export const ejemplo: DatosPresupuesto = {
  codigo: "2026/0105",
  fecha: new Date("2026-09-30T15:00:00Z"),
  moneda: "ARS",
  validezDias: 7,
  baseAjuste: "CAC General",
  formaContratacion: "Ajuste Alzado",
  anticipoPct: 40,
  incluyeIva: false,
  ivaPct: 21,
  bonificacion: null,
  cliente: "Constructora Ejemplo",
  director: "Martín Gómez",
  direccion: "Av. Córdoba 1234, CABA",
  items: [
    { descripcion: "Perforaciones en viga, 152mm x 29cm de espesor", cantidad: 9, unidad: "u", precioUnitario: 168000, tipoServicio: "perforacion", elemento: "Viga", diametroMm: 152, espesorCm: 29 },
  ],
  totales: calcularTotales([{ cantidad: 9, precioUnitario: 168000 }], { bonificacion: null, incluyeIva: false, ivaPct: 21 }),
};

const texto = (docx: Uint8Array, parte: string) =>
  [...new PizZip(docx).file(parte)!.asText().matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

describe("documento presupuesto", () => {
  it("rellena encabezado, ítems, totales y bloques sin dejar tags", () => {
    const docx = renderDocx("presupuesto", armar(ejemplo, bloquesPorDefecto(ejemplo)));
    const header = texto(docx, "word/header1.xml");
    const cuerpo = texto(docx, "word/document.xml");
    expect(header).toContain("2026/0105");
    expect(header).toContain("30/09/2026");
    expect(header).toContain("Pesos argentinos (ARS)");
    expect(header).toContain("Martín Gómez");
    expect(cuerpo).toContain("Estimados Sres. Constructora Ejemplo, en respuesta");
    expect(cuerpo).toContain("9 perforaciones de Ø 152 mm sobre viga de 29 cm de espesor");
    expect(cuerpo).toContain("$ 168.000,00");
    expect(cuerpo).toContain("$ 1.512.000,00");
    expect(cuerpo).toContain("Cotización válida por 7 días corridos");
    expect(cuerpo).toContain("El valor cotizado no incluye IVA.");
    expect(`${header}${cuerpo}`).not.toMatch(/\{[#/^]?\w+\}/);
  });

  it("repite la fila de ítems y los párrafos de los bloques", () => {
    const d = {
      ...ejemplo,
      items: [ejemplo.items[0], { ...ejemplo.items[0], descripcion: "Corte de losa", cantidad: 3 }],
      totales: calcularTotales(
        [
          { cantidad: 9, precioUnitario: 168000 },
          { cantidad: 3, precioUnitario: 168000 },
        ],
        { bonificacion: null, incluyeIva: false, ivaPct: 21 },
      ),
    };
    const cuerpo = texto(renderDocx("presupuesto", armar(d, { ...bloquesPorDefecto(d), garantia: "Línea uno\n**Línea dos**" })), "word/document.xml");
    expect(cuerpo).toContain("Corte de losa");
    expect(cuerpo).toContain("$ 2.016.000,00");
    expect(cuerpo).toContain("Línea unoLínea dos");
  });
});

describe("negritas en bloques", () => {
  it("la parte en negrita queda en un run con <w:b/>, aunque no sea la primera", () => {
    const d = ejemplo;
    const xml = new PizZip(renderDocx("presupuesto", armar(d, { ...bloquesPorDefecto(d), garantia: "Normal **en negrita** y normal" })))
      .file("word/document.xml")!
      .asText();
    // Cada run por separado (hay runs vacíos <w:t/> entre medio).
    const runs = [...xml.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
    const run = (t: string) => runs.find((r) => r.includes(`>${t}</w:t>`))!;
    expect(run("en negrita")).toContain("<w:b/>");
    expect(run("Normal ")).not.toContain("<w:b/>");
    expect(run(" y normal")).not.toContain("<w:b/>");
  });
});
