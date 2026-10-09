// Documento "Control y Balance de Perforaciones" (spec/06 §3.5). Puro, como presupuesto.ts.

import { etiquetaDiferencia, ESTADOS_REGISTRO, rangoPisos, type EstadoRegistro, type FilaBalance } from "@/domain/balance";
import { interpolar, parrafosDe, type Parrafo } from "@/domain/bloques";
import { fechaAR, type DefBloque } from "./presupuesto";

export type DatosControl = {
  codigo: string;
  fecha: Date;
  cliente: string;
  director: string | null;
  direccion: string;
  operadores: string[];
  /** Registros ya ordenados de arriba hacia abajo. */
  registros: { piso: string; elemento: string; espesorCm: number | null; diametroMm: number | null; cantidad: number; estado: EstadoRegistro; observacion: string | null }[];
  balance: { filas: FilaBalance[]; totales: { cotizadas: number; ejecutadas: number; diferencia: number } };
};

export const BLOQUES: DefBloque[] = [
  { id: "subtitulo", titulo: "Subtítulo del registro" },
  { id: "observaciones", titulo: "Observaciones" },
  { id: "conclusiones", titulo: "Balance por diámetro", ayuda: "Una conclusión por línea (se imprimen con viñetas)." },
];

const un = (n: number) => `${n} ${Math.abs(n) === 1 ? "unidad" : "unidades"}`;

export function variables(d: DatosControl): Record<string, string> {
  return {
    cliente: d.cliente,
    direccion: d.direccion,
    director: d.director ?? "",
    rango_pisos: rangoPisos(d.registros.map((r) => r.piso)),
    total_cotizadas: String(d.balance.totales.cotizadas),
    total_ejecutadas: String(d.balance.totales.ejecutadas),
  };
}

/** Textos por defecto, como los redacta PAS en el Word de ejemplo. */
export function bloquesPorDefecto(d: DatosControl): Record<string, string> {
  const cotizadas = d.balance.filas.filter((f) => f.cotizadas > 0);
  const ultimo = d.registros.at(-1)?.piso;
  return {
    subtitulo: "Registro Detallado por Piso ({rango_pisos})",
    observaciones: [
      cotizadas.length &&
        `Las cantidades de perforaciones cotizadas originalmente fueron de {total_cotizadas} unidades en total, correspondientes a ${cotizadas.map((f) => `${un(f.cotizadas)} de ${f.diametroMm} mm`).join(" y ")}.`,
      ultimo ? `Al finalizar los trabajos hasta el piso ${ultimo}, se presenta el siguiente balance detallado:` : "Se presenta el siguiente balance detallado:",
    ]
      .filter(Boolean)
      .join("\n"),
    conclusiones: d.balance.filas
      .map((f) => {
        const t = `**Diámetro ${f.diametroMm} mm:**`;
        if (f.diferencia < 0)
          return `${t} De las ${un(f.cotizadas)} cotizadas, se han ejecutado ${un(f.ejecutadas)}, por lo que aún quedan pendientes ${un(-f.diferencia)} de este diámetro por realizar.`;
        if (f.diferencia > 0)
          return `${t} Se remarca que hemos ejecutado perforaciones adicionales a las contratadas. De las ${un(f.cotizadas)} cotizadas, se han realizado un total de ${un(f.ejecutadas)}, lo cual representa ${un(f.diferencia)} de más (+${f.diferencia} u. extra) en este diámetro.`;
        return `${t} Se ejecutaron las ${un(f.cotizadas)} cotizadas.`;
      })
      .join("\n"),
  };
}

export function armar(d: DatosControl, bloques: Record<string, string>) {
  const vars = variables(d);
  const parrafos: Record<string, Parrafo[]> = Object.fromEntries(BLOQUES.map((b) => [b.id, parrafosDe(interpolar(bloques[b.id] ?? "", vars))]));
  const t = d.balance.totales;
  return {
    codigo: d.codigo,
    fecha: fechaAR(d.fecha),
    cliente: d.cliente,
    director: d.director ?? "—",
    direccion: d.direccion,
    resumen: d.balance.filas.map((f) => `Ø ${f.diametroMm} mm`).join(" y ") || "—",
    operadores: d.operadores.join(", ") || "—",
    rango_pisos: vars.rango_pisos,
    /** El subtítulo va en una línea del Word: texto plano. */
    subtitulo_texto: parrafos.subtitulo.map((p) => p.runs.map((r) => r.t).join("")).join(" "),
    registros: d.registros.map((r) => ({
      piso: /^\d/.test(r.piso) ? `Piso ${r.piso}` : r.piso,
      elemento: r.elemento,
      espesor: r.espesorCm ? `${r.espesorCm} cm` : "—",
      diametro: r.diametroMm ? `${r.diametroMm} mm` : "—",
      cantidad: String(r.cantidad),
      estado: r.observacion ? `${ESTADOS_REGISTRO[r.estado]} (${r.observacion})` : ESTADOS_REGISTRO[r.estado],
    })),
    ejecutado: d.balance.filas.filter((f) => f.ejecutadas > 0).map((f) => ({ diametro: `Ø ${f.diametroMm} mm`, texto: un(f.ejecutadas) })),
    total_ejecutado: un(t.ejecutadas),
    balance: d.balance.filas.map((f) => ({ diametro: `${f.diametroMm} mm`, cotizadas: `${f.cotizadas} u.`, ejecutadas: `${f.ejecutadas} u.`, diferencia: etiquetaDiferencia(f.diferencia).texto, pendiente: f.diferencia < 0 })),
    total_cotizadas: `${t.cotizadas} u.`,
    total_ejecutadas: `${t.ejecutadas} u.`,
    total_diferencia: `${t.diferencia > 0 ? "+" : ""}${un(t.diferencia)} en total general`,
    ...parrafos,
  };
}

export type DocControl = ReturnType<typeof armar>;
