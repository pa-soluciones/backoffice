import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { armar, bloquesPorDefecto, type DatosCertificacion } from "@/documents/certificacion";
import { renderDocx } from "@/documents/render";

const linea = (descripcion: string, cantidad: number, precioUnitario: number) => ({ descripcion, cantidad, unidad: "u" as const, precioUnitario, subtotal: cantidad * precioUnitario });

const obra: DatosCertificacion = {
  codigo: "2026/0105-C1",
  alcance: "obra",
  tipo: "final",
  fecha: new Date("2026-09-10T15:00:00Z"),
  moneda: "ARS",
  incluyeIva: false,
  bonificado: true,
  anticipoPct: 40,
  cliente: "Constructora Ejemplo",
  director: "Martín Gómez",
  direccion: "Av. Córdoba 1234, CABA",
  presupuestoCodigo: "2026/0105",
  presupuestoFecha: new Date("2026-08-05T15:00:00Z"),
  originales: [linea("Perforaciones en viga, 102mm x 29cm de espesor", 16, 128750), linea("Perforaciones en viga, 152mm x 29cm de espesor", 3, 160000)],
  adicionales: [{ codigo: "2026/0105-AD1", lineas: [linea("Perforaciones en viga, 102mm x 29cm de espesor", 8, 128750)] }],
  certificadoAnterior: 0,
  pagos: [
    { concepto: "Anticipo del 40% sobre el presupuesto original (2026/0105)", estado: "abonado", importe: 1_016_000, pendiente: 0 },
    { concepto: "Saldo del 60% sobre el presupuesto original (2026/0105)", estado: "pendiente", importe: 1_806_000, pendiente: 1_806_000 },
    { concepto: "Trabajos adicionales 2026/0105-AD1", estado: "pendiente", importe: 1_030_000, pendiente: 1_030_000 },
  ],
};

const texto = (docx: Uint8Array, parte: string) =>
  [...new PizZip(docx).file(parte)!.asText().matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

describe("documento certificación", () => {
  it("certificación de obra: originales, adicionales, pagos y saldo en letras", () => {
    const docx = renderDocx("certificacion", armar(obra, bloquesPorDefecto(obra)));
    const header = texto(docx, "word/header1.xml");
    const cuerpo = texto(docx, "word/document.xml");
    expect(header).toContain("2026/0105-C1");
    expect(header).toContain("2026/0105 - 05/08/2026");
    expect(cuerpo).toContain("CERTIFICACIÓN DE OBRA");
    expect(cuerpo).toContain("TRABAJOS CERTIFICADOS SEGÚN PRESUPUESTO NRO. 2026/0105");
    expect(cuerpo).toContain("Subtotal trabajos originales con Descuento$ 2.540.000,00");
    expect(cuerpo).toContain("TRABAJOS ADICIONALES INCORPORADOS");
    expect(cuerpo).toContain("3Perforaciones en viga, 102mm x 29cm de espesor8");
    expect(cuerpo).toContain("$ 3.570.000,00");
    expect(cuerpo).toContain("ha percibido de conformidad el anticipo del 40%");
    expect(cuerpo).toContain("SALDO TOTAL POR ABONAR$ 2.836.000,00");
    expect(cuerpo).toContain("PESOS DOS MILLONES OCHOCIENTOS TREINTA Y SEIS MIL CON 00/100 ($ 2.836.000,00)");
    expect(cuerpo).toContain("Vigencia del descuento comercial.");
    const xml = new PizZip(docx).file("word/document.xml")!.asText();
    expect(xml).toMatch(/00B050"\/><\/w:rPr><w:t xml:space="preserve">ABONADO/);
    expect(xml).toMatch(/EE0000"\/>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr><w:t xml:space="preserve">PENDIENTE/);
    expect(`${header}${cuerpo}`).not.toMatch(/\{[#/^]?\w+\}|&lt;[^&]+&gt;/);
  });

  it("certificación de adicional: sin trabajos originales", () => {
    const ad: DatosCertificacion = { ...obra, codigo: "2026/0105-AD1-C1", alcance: "adicional", originales: [], pagos: [obra.pagos[2]] };
    const cuerpo = texto(renderDocx("certificacion", armar(ad, bloquesPorDefecto(ad))), "word/document.xml");
    expect(cuerpo).toContain("CERTIFICACIÓN DE TRABAJO ADICIONAL");
    expect(cuerpo).not.toContain("TRABAJOS CERTIFICADOS SEGÚN");
    expect(cuerpo).toContain("1Perforaciones en viga, 102mm x 29cm de espesor8");
    expect(cuerpo).toContain("PESOS UN MILLÓN TREINTA MIL CON 00/100");
  });
});
