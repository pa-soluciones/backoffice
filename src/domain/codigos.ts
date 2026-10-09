// Códigos de presupuesto (spec/05 §2): AAAA/NNNN, revisiones " Rn", adicionales "-ADn".

/** 2026, 105 → "2026/0105". Más de 4 dígitos crece sin romper el orden. */
export function codigoPresupuesto(anio: number, numero: number) {
  return `${anio}/${String(numero).padStart(4, "0")}`;
}

/** Revisión 0 = original (sin sufijo). */
export function codigoRevision(codigo: string, nro: number) {
  return nro === 0 ? codigo : `${codigo} R${nro}`;
}

/** Año calendario en Argentina (la numeración reinicia por año local, no UTC). */
export function anioArgentina(fecha = new Date()) {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(fecha));
}

/**
 * Interpreta lo que el usuario tipea en el buscador como código:
 * "2026/0105", "2026/105", "0105", "105" → { anio?, numero }.
 */
export function parsearCodigo(texto: string): { anio?: number; numero: number } | null {
  const t = texto.trim();
  const completo = t.match(/^(\d{4})\s*\/\s*(\d{1,6})$/);
  if (completo) return { anio: Number(completo[1]), numero: Number(completo[2]) };
  const solo = t.match(/^\d{1,6}$/);
  if (solo) return { numero: Number(t) };
  return null;
}
