// Bloques de texto editables de los documentos (spec/06 §3): una línea = un párrafo,
// **negrita** para resaltar, y variables {cliente}, {validez_dias}… que se resuelven al renderizar.

export type Run = { t: string; b: boolean };
export type Parrafo = { runs: Run[] };

/** "**Plazo:** a convenir" → [{t:"Plazo:", b:true}, {t:" a convenir", b:false}] */
export function runsDe(linea: string): Run[] {
  const partes = linea.split("**");
  return partes.map((t, i) => ({ t, b: i % 2 === 1 })).filter((r) => r.t !== "");
}

/** Texto del bloque → párrafos para la plantilla. Las líneas vacías se descartan. */
export function parrafosDe(texto: string): Parrafo[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
    .map((l) => ({ runs: runsDe(l) }));
}

/** Reemplaza {variable} por su valor; las desconocidas quedan tal cual (así se ven en la vista previa). */
export function interpolar(texto: string, vars: Record<string, string>) {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** Variables que el texto usa y no existen (para avisar en el editor). */
export function variablesDesconocidas(texto: string, vars: Record<string, string>) {
  return [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !(k in vars)))];
}
