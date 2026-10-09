// Balance de perforaciones (spec/07 §2): cotizado vs ejecutado por diámetro. Sin DB.

export const ESTADOS_REGISTRO = { finalizado: "Finalizado", parcial: "Parcial", con_observacion: "Con observación" } as const;
export type EstadoRegistro = keyof typeof ESTADOS_REGISTRO;

export type Cotizado = { diametroMm: number; cantidad: number; precioUnitario: number };
export type Ejecutado = { diametroMm: number; cantidad: number };

export type FilaBalance = { diametroMm: number; cotizadas: number; ejecutadas: number; diferencia: number; precioUnitario: number | null };

export function balance(cotizado: Cotizado[], ejecutado: Ejecutado[]) {
  const filas = new Map<number, FilaBalance>();
  const fila = (d: number) => filas.get(d) ?? filas.set(d, { diametroMm: d, cotizadas: 0, ejecutadas: 0, diferencia: 0, precioUnitario: null }).get(d)!;
  for (const c of cotizado) {
    const f = fila(c.diametroMm);
    f.cotizadas += c.cantidad;
    f.precioUnitario ??= c.precioUnitario; // ponytail: primer precio del Ø; si hay varios precios por Ø, desglosar por ítem
  }
  for (const e of ejecutado) fila(e.diametroMm).ejecutadas += e.cantidad;
  const lista = [...filas.values()].sort((a, b) => a.diametroMm - b.diametroMm);
  for (const f of lista) f.diferencia = f.ejecutadas - f.cotizadas;
  const suma = (k: "cotizadas" | "ejecutadas" | "diferencia") => lista.reduce((s, f) => s + f[k], 0);
  return { filas: lista, totales: { cotizadas: suma("cotizadas"), ejecutadas: suma("ejecutadas"), diferencia: suma("diferencia") } };
}

const u = (n: number) => `${n} ${Math.abs(n) === 1 ? "unidad" : "unidades"}`;

/** RF-BAL-02: "+8 unidades (Ejecutadas en exceso)" / "-5 unidades (Pendientes de realizar)" / "Completo". */
export function etiquetaDiferencia(d: number) {
  if (d > 0) return { texto: `+${u(d)} (Ejecutadas en exceso)`, tono: "exceso" as const };
  if (d < 0) return { texto: `-${u(-d)} (Pendientes de realizar)`, tono: "pendiente" as const };
  return { texto: "Completo", tono: "completo" as const };
}

/** Orden de pisos de arriba hacia abajo: Azotea, 17…1, PB, SS1, SS2… */
export function alturaPiso(piso: string) {
  const p = piso.trim().toUpperCase();
  if (/^(AZOTEA|TERRAZA)/.test(p)) return 10_000;
  if (/^(PB|PLANTA BAJA)$/.test(p)) return 0;
  const ss = p.match(/^(SS|SUBSUELO)\s*(\d+)/);
  if (ss) return -Number(ss[2]);
  const n = p.match(/\d+/);
  return n ? Number(n[0]) : 0.5; // texto libre ("Sala de máquinas"): entre PB y el 1°
}

/** "Pisos 17 al 2" a partir de los pisos con registros. */
export function rangoPisos(pisos: string[]) {
  const unicos = [...new Set(pisos)].sort((a, b) => alturaPiso(b) - alturaPiso(a));
  if (unicos.length === 0) return "";
  if (unicos.length === 1) return `Piso ${unicos[0]}`;
  return `Pisos ${unicos[0]} al ${unicos.at(-1)}`;
}
