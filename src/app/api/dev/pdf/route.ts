import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { docxToPdf } from "@/lib/pdf";

// Solo desarrollo: convierte el Word original del presupuesto para verificar Gotenberg + fuentes.
export async function GET() {
  await connection();
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  const docx = await readFile(path.join(process.cwd(), "spec/templates/Template Presupuesto.docx"));
  const pdf = await docxToPdf(docx, "presupuesto.docx");
  return new Response(pdf as BodyInit, { headers: { "Content-Type": "application/pdf" } });
}
