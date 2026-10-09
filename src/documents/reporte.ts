// Documento "Reporte Mensual Estadístico" por obra y período (spec/06 §3.6). Puro.

import { interpolar, parrafosDe, type Parrafo } from "@/domain/bloques";
import { fechaAR, type DefBloque } from "./presupuesto";

export type DatosReporte = {
  codigo: string;
  fecha: Date;
  cliente: string;
  direccion: string;
  /** "2026-08" */
  periodo: string;
  trabajadores: number;
  dias: number;
  accidentes: number;
  diasPerdidos: number;
  responsable: string;
};

export const BLOQUES: DefBloque[] = [{ id: "observaciones", titulo: "Observaciones / comentarios", ayuda: "Un párrafo por línea." }];

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const nombreMes = (periodo: string) => MESES[Number(periodo.slice(5, 7)) - 1];

export function variables(d: DatosReporte): Record<string, string> {
  return { cliente: d.cliente, direccion: d.direccion, mes: nombreMes(d.periodo), anio: d.periodo.slice(0, 4) };
}

export function bloquesPorDefecto(d: DatosReporte): Record<string, string> {
  return {
    observaciones:
      d.accidentes > 0
        ? `Se registraron ${d.accidentes} accidente(s) en el período, con ${d.diasPerdidos} día(s) perdido(s).`
        : "Sin accidentes ni incidentes durante el período reportado.",
  };
}

export function armar(d: DatosReporte, bloques: Record<string, string>) {
  const parrafos: Record<string, Parrafo[]> = Object.fromEntries(BLOQUES.map((b) => [b.id, parrafosDe(interpolar(bloques[b.id] ?? "", variables(d)))]));
  return {
    codigo: d.codigo,
    fecha: fechaAR(d.fecha),
    cliente: d.cliente,
    direccion: d.direccion,
    anio: d.periodo.slice(0, 4),
    mes: nombreMes(d.periodo),
    trabajadores: String(d.trabajadores),
    accidentes: String(d.accidentes),
    dias: String(d.dias),
    dias_perdidos: String(d.diasPerdidos),
    responsable: d.responsable,
    ...parrafos,
  };
}

export type DocReporte = ReturnType<typeof armar>;
