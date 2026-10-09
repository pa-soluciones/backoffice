import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

// Genera el DOCX a partir de las plantillas de /templates (convertidas desde los Word de PAS
// con scripts/plantillas/convertir.mjs).

export type Plantilla = "presupuesto";

export function renderDocx(plantilla: Plantilla, datos: object): Uint8Array {
  const buf = readFileSync(path.join(process.cwd(), "templates", `${plantilla}.docx`));
  const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(datos);
  return doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
}
