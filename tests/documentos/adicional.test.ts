import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { armar, bloquesPorDefecto, type DatosAdicional } from "@/documents/adicional";
import { renderDocx } from "@/documents/render";
import { calcularTotales } from "@/domain/montos";

const datos: DatosAdicional = {
  codigo: "2026/0105-AD1",
  fecha: new Date("2026-10-01T15:00:00Z"),
  moneda: "ARS",
  validezDias: 15,
  anticipoPct: 0,
  incluyeIva: false,
  bonificado: true,
  cliente: "Constructora Ejemplo",
  director: "Martín Gómez",
  direccion: "Av. Córdoba 1234, CABA",
  presupuestoCodigo: "2026/0105",
  presupuestoFecha: new Date("2026-08-05T15:00:00Z"),
  items: [{ descripcion: "Perforaciones en viga, 102mm", cantidad: 8, unidad: "u", precioUnitario: 128750, tipoServicio: "perforacion", elemento: "Viga", diametroMm: 102, espesorCm: null }],
  totales: calcularTotales([{ cantidad: 8, precioUnitario: 128750 }], { bonificacion: null, incluyeIva: false, ivaPct: 21 }),
};

const texto = (docx: Uint8Array, parte: string) =>
  [...new PizZip(docx).file(parte)!.asText().matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

describe("documento adicional", () => {
  it("rellena el Word de adicionales sin dejar tags ni placeholders", () => {
    const docx = renderDocx("adicional", armar(datos, bloquesPorDefecto(datos)));
    const header = texto(docx, "word/header1.xml");
    const cuerpo = texto(docx, "word/document.xml");
    expect(header).toContain("2026/0105-AD1");
    expect(header).toContain("Nro. 2026/0105 — 05/08/2026");
    expect(header).toContain("Martín Gómez");
    expect(cuerpo).toContain("Cotización de trabajos adicionales solicitados por la Contratista Constructora Ejemplo");
    expect(cuerpo).toContain("8 perforaciones de Ø 102 mm sobre viga");
    expect(cuerpo).toContain("$ 1.030.000,00");
    expect(cuerpo).toContain("incluyen la bonificación comercial vigente del Presupuesto 2026/0105");
    expect(cuerpo).toContain("Validez de la presente cotización: 15 días");
    expect(`${header}${cuerpo}`).not.toMatch(/\{[#/^]?\w+\}|&lt;[^&]+&gt;/);
  });
});
