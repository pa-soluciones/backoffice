import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { medidaFirma } from "@/domain/archivos";

// Genera el DOCX a partir de las plantillas de /templates (convertidas desde los Word de PAS
// con scripts/plantillas/convertir.mjs).

export type Plantilla = "presupuesto" | "adicional" | "control" | "certificacion" | "reporte";
export type Firma = { png: Uint8Array; ancho: number; alto: number };

export function renderDocx(plantilla: Plantilla, datos: object, firma?: Firma | null): Uint8Array {
  const buf = readFileSync(path.join(process.cwd(), "templates", `${plantilla}.docx`));
  const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(datos);
  const zip = doc.getZip();
  if (firma) ponerFirma(zip, firma);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

/**
 * Reemplaza la imagen marcada como "firma" en la plantilla (debajo de "Atentamente.") por la
 * firma de la empresa, ajustando el tamaño. Sin firma cargada queda la imagen original (el logo).
 */
function ponerFirma(zip: PizZip, firma: Firma) {
  const parte = "word/document.xml";
  const xml = zip.file(parte)!.asText();
  const marca = xml.indexOf('name="firma"');
  if (marca < 0) throw new Error("La plantilla no tiene la imagen de firma marcada.");
  const ini = xml.lastIndexOf("<w:drawing>", marca);
  const fin = xml.indexOf("</w:drawing>", marca) + "</w:drawing>".length;
  const { cx, cy } = medidaFirma(firma.ancho, firma.alto);
  const dibujo = xml
    .slice(ini, fin)
    .replace(/<a:extLst>[\s\S]*?<\/a:extLst>/g, "") // versión SVG del logo: Word la preferiría a la firma
    .replace(/cx="\d+" cy="\d+"/g, `cx="${cx}" cy="${cy}"`);
  const rId = dibujo.match(/r:embed="([^"]+)"/)![1];
  const rels = zip.file("word/_rels/document.xml.rels")!.asText();
  const destino = rels.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`))![1];
  zip.file(parte, xml.slice(0, ini) + dibujo + xml.slice(fin));
  zip.file(`word/${destino}`, firma.png);
}
