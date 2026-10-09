// Tipos de archivo permitidos y detección del tipo real por sus primeros bytes (spec/12 RNF-20):
// la extensión o el tipo que declara el navegador no alcanzan.

export const TIPOS_PERMITIDOS = {
  "image/jpeg": { ext: ".jpg,.jpeg", nombre: "Imagen JPG" },
  "image/png": { ext: ".png", nombre: "Imagen PNG" },
  "image/webp": { ext: ".webp", nombre: "Imagen WebP" },
  "application/pdf": { ext: ".pdf", nombre: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ".docx", nombre: "Word" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: ".xlsx", nombre: "Excel" },
  "image/vnd.dwg": { ext: ".dwg", nombre: "Plano DWG" },
} as const;
export type MimePermitido = keyof typeof TIPOS_PERMITIDOS;

export const ACCEPT = Object.values(TIPOS_PERMITIDOS)
  .map((t) => t.ext)
  .join(",");

export const CATEGORIAS_ANEXO = ["Foto de obra", "Plano", "Orden de compra", "Comprobante", "Contrato", "Otro"] as const;

const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Familia del archivo según sus primeros bytes (16 alcanzan). */
export function familiaPorFirma(b: Uint8Array): "jpeg" | "png" | "webp" | "pdf" | "zip" | "dwg" | null {
  if (empieza(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (empieza(b, ascii("RIFF")) && empieza(b, ascii("WEBP"), 8)) return "webp";
  if (empieza(b, ascii("%PDF-"))) return "pdf";
  if (empieza(b, [0x50, 0x4b, 0x03, 0x04])) return "zip"; // docx / xlsx
  if (empieza(b, ascii("AC10"))) return "dwg";
  return null;
}

const FAMILIA: Record<MimePermitido, ReturnType<typeof familiaPorFirma>> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "zip",
  "image/vnd.dwg": "dwg",
};

export const esPermitido = (mime: string): mime is MimePermitido => mime in TIPOS_PERMITIDOS;

/** El contenido coincide con el tipo declarado. */
export function contenidoCoincide(mime: string, inicio: Uint8Array) {
  return esPermitido(mime) && FAMILIA[mime] === familiaPorFirma(inicio);
}

/** Tipo a partir de la extensión (los navegadores no siempre informan DWG). */
export function mimePorNombre(nombre: string): MimePermitido | null {
  const ext = nombre.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (!ext) return null;
  return (Object.entries(TIPOS_PERMITIDOS).find(([, t]) => t.ext.split(",").includes(ext))?.[0] as MimePermitido) ?? null;
}
