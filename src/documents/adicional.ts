// Documento "Cotización de trabajos adicionales" (spec/06 §3.2). Puro, como presupuesto.ts.

import { interpolar, parrafosDe, type Parrafo } from "@/domain/bloques";
import { UNIDADES } from "@/domain/items";
import { formatearMonto, type Moneda, type Totales } from "@/domain/montos";
import { fechaAR, MONEDA_TEXTO, resumenItems, type DatosPresupuesto, type DefBloque } from "./presupuesto";

export type DatosAdicional = {
  codigo: string;
  fecha: Date;
  moneda: Moneda;
  validezDias: number;
  anticipoPct: number;
  incluyeIva: boolean;
  bonificado: boolean;
  cliente: string;
  director: string | null;
  direccion: string;
  presupuestoCodigo: string;
  presupuestoFecha: Date | null;
  items: DatosPresupuesto["items"];
  totales: Totales;
};

export const BLOQUES: DefBloque[] = [
  { id: "objeto", titulo: "Objeto" },
  { id: "descripcion", titulo: "Descripción del servicio" },
  { id: "observaciones", titulo: "Observaciones", ayuda: "Una observación por línea." },
];

export function variables(d: DatosAdicional): Record<string, string> {
  return {
    cliente: d.cliente,
    direccion: d.direccion,
    director: d.director ?? "",
    presupuesto_codigo: d.presupuestoCodigo,
    presupuesto_fecha: d.presupuestoFecha ? fechaAR(d.presupuestoFecha) : "",
    validez_dias: String(d.validezDias),
    anticipo_pct: String(d.anticipoPct),
    moneda_nombre: MONEDA_TEXTO[d.moneda],
  };
}

/** Textos por defecto (del Word de PAS). */
export function bloquesPorDefecto(d: DatosAdicional): Record<string, string> {
  return {
    objeto: `Cotización de trabajos adicionales solicitados por la Contratista {cliente}, en el marco de la obra en {direccion}${d.director ? ", bajo la dirección de obra de {director}" : ""}, complementarios al presupuesto Nro. {presupuesto_codigo}${d.presupuestoFecha ? " con fecha {presupuesto_fecha}" : ""}.`,
    descripcion: `Ejecución de ${resumenItems(d.items)}, ejecutadas con sistema de perforación diamantada y bajo idénticas condiciones técnicas y comerciales que las establecidas en el presupuesto de referencia.`,
    observaciones: [
      d.bonificado && "Los valores unitarios incluyen la bonificación comercial vigente del Presupuesto {presupuesto_codigo}.",
      d.incluyeIva ? "Los importes incluyen IVA y se encuentran expresados en {moneda_nombre}." : "Los importes no incluyen IVA y se encuentran expresados en {moneda_nombre}.",
      d.anticipoPct > 0 ? "{anticipo_pct}% de anticipo al aprobar los trabajos y el saldo contra finalización." : "Forma de pago a coordinar entre las partes.",
      "Validez de la presente cotización: {validez_dias} días corridos desde la fecha de emisión.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function armar(d: DatosAdicional, bloques: Record<string, string>) {
  const vars = variables(d);
  const parrafos: Record<string, Parrafo[]> = Object.fromEntries(BLOQUES.map((b) => [b.id, parrafosDe(interpolar(bloques[b.id] ?? "", vars))]));
  return {
    codigo: d.codigo,
    fecha: fechaAR(d.fecha),
    cliente: d.cliente,
    director: d.director ?? "—",
    direccion: d.direccion,
    presupuesto_codigo: d.presupuestoCodigo,
    presupuesto_fecha: d.presupuestoFecha ? fechaAR(d.presupuestoFecha) : "—",
    items: d.items.map((i, n) => ({
      nro: String(n + 1),
      descripcion: i.descripcion,
      cantidad: `${i.cantidad}${i.unidad === "u" ? "" : ` ${UNIDADES[i.unidad]}`}`,
      precio: formatearMonto(d.totales.lineas[n]?.precioUnitario ?? i.precioUnitario, d.moneda),
      subtotal: formatearMonto(d.totales.lineas[n]?.subtotal ?? 0, d.moneda),
    })),
    total: formatearMonto(d.totales.neto, d.moneda),
    ...parrafos,
  };
}

export type DocAdicional = ReturnType<typeof armar>;
