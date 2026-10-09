// Ítems estructurados de presupuesto (spec/05 §1.1).

export const TIPOS_SERVICIO = {
  perforacion: "Perforación",
  corte: "Corte",
  sellado_juntas: "Sellado de juntas",
  boca_ataque: "Boca de ataque",
  anclaje: "Anclaje",
  mano_obra: "Mano de obra",
  otro: "Otro",
} as const;
export type TipoServicio = keyof typeof TIPOS_SERVICIO;

export const ELEMENTOS = ["Viga", "Tabique", "Losa", "Columna", "Muro", "Platea", "Otro"] as const;
export const UNIDADES = { u: "u", ml: "ml", m2: "m²", m3: "m³", h: "h", gl: "gl" } as const;
export type Unidad = keyof typeof UNIDADES;

export type ItemEstructurado = {
  tipoServicio: TipoServicio;
  elemento: string | null;
  diametroMm: number | null;
  espesorCm: number | null;
  unidad: Unidad;
};

const PLURAL: Partial<Record<TipoServicio, string>> = {
  perforacion: "Perforaciones",
  corte: "Cortes",
  boca_ataque: "Bocas de ataque",
  anclaje: "Anclajes",
};

/** "Perforaciones en viga, 152mm x 29cm de espesor" (como en el template de presupuesto). */
export function descripcionAuto(it: ItemEstructurado) {
  const base = PLURAL[it.tipoServicio] ?? TIPOS_SERVICIO[it.tipoServicio];
  const donde = it.elemento ? ` en ${it.elemento.toLowerCase()}` : "";
  const medidas = [it.diametroMm ? `${it.diametroMm}mm` : null, it.espesorCm ? `${it.espesorCm}cm de espesor` : null]
    .filter(Boolean)
    .join(" x ");
  return `${base}${donde}${medidas ? `, ${medidas}` : ""}`;
}
