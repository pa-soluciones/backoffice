// Asistente de IA para redactar (spec/10). Puro: modelos, costos y control de cifras.

export const MODELOS = {
  "claude-opus-5-5": { nombre: "Claude Opus 5.5 (el más capaz)", entrada: 4, salida: 20 },
  "claude-sonnet-5-5": { nombre: "Claude Sonnet 5.5 (equilibrado)", entrada: 2, salida: 10 },
  "claude-haiku-5-5": { nombre: "Claude Haiku 5.5 (el más barato y rápido)", entrada: 0.1, salida: 0.5 },
} as const;
export type Modelo = keyof typeof MODELOS;
export const MODELO_DEFAULT: Modelo = "claude-opus-5-5";

export const ACCIONES_IA = {
  mejorar: "Mejorar redacción",
  acortar: "Más corto",
  formal: "Más formal",
  ortografia: "Corregir ortografía",
  desde_notas: "Redactar desde los datos (pedido, visita o balance)",
} as const;
export type AccionIA = keyof typeof ACCIONES_IA | "instruccion";

/** Costo en USD de una llamada (precios por millón de tokens). */
export function costoUsd(modelo: string, tokensEntrada: number, tokensSalida: number) {
  const m = MODELOS[modelo as Modelo] ?? MODELOS[MODELO_DEFAULT];
  return (tokensEntrada * m.entrada + tokensSalida * m.salida) / 1_000_000;
}

const numeros = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));

/** Cifras que la propuesta agrega y no estaban en el texto ni en el contexto (spec/10 §4). */
export function cifrasNuevas(propuesta: string, conocido: string) {
  const base = new Set(numeros(conocido));
  return [...new Set(propuesta.match(/\d+(?:[.,]\d+)*/g) ?? [])].filter((n) => !base.has(n.replace(/[.,]/g, "")));
}
