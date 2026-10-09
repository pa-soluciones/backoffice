import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { renderDocx } from "@/documents/render";
import { armar, bloquesPorDefecto, type DatosReporte } from "@/documents/reporte";

const d: DatosReporte = {
  codigo: "Av. Córdoba 1234, CABA · 2026-08",
  fecha: new Date("2026-09-01T15:00:00Z"),
  cliente: "Constructora Ejemplo",
  direccion: "Av. Córdoba 1234, CABA",
  periodo: "2026-08",
  trabajadores: 2,
  dias: 5,
  accidentes: 0,
  diasPerdidos: 0,
  responsable: "Juan Pérez",
};
const texto = (docx: Uint8Array, parte: string) =>
  [...new PizZip(docx).file(parte)!.asText().matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

describe("documento reporte mensual", () => {
  it("rellena el Word del reporte estadístico", () => {
    const docx = renderDocx("reporte", armar(d, bloquesPorDefecto(d)));
    const header = texto(docx, "word/header1.xml");
    const cuerpo = texto(docx, "word/document.xml");
    expect(header).toContain("01/09/2026");
    expect(cuerpo).toContain("Constructora Ejemplo");
    expect(cuerpo).toContain("2026Agosto");
    expect(cuerpo).toContain("DIAS PERDIDOS POR ACCIDENTES2050");
    expect(cuerpo).toContain("Sin accidentes ni incidentes durante el período reportado.");
    expect(cuerpo).toContain("Juan Pérez");
    expect(`${header}${cuerpo}`).not.toMatch(/\{[#/^]?\w+\}|&lt;[^&]+&gt;/);
  });
});
