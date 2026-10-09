// Documentos "Certificación de Obra" y "Certificación de trabajo adicional" (spec/06 §3.3, §3.4).
// Una sola plantilla: la de adicional no lleva la sección de trabajos originales. Puro.

import { interpolar, parrafosDe, type Parrafo } from "@/domain/bloques";
import { ESTADOS_COBRO, type EstadoCobro } from "@/domain/cobros";
import { UNIDADES, type Unidad } from "@/domain/items";
import { montoEnLetras } from "@/domain/letras";
import { formatearMonto, type Moneda } from "@/domain/montos";
import { fechaAR, MONEDA_TEXTO, type DefBloque } from "./presupuesto";

export type LineaCert = { descripcion: string; cantidad: number; unidad: Unidad; precioUnitario: number; subtotal: number };

export type DatosCertificacion = {
  codigo: string;
  /** Obra (con los trabajos del presupuesto) o de un adicional. */
  alcance: "obra" | "adicional";
  tipo: "parcial" | "final";
  fecha: Date;
  moneda: Moneda;
  incluyeIva: boolean;
  bonificado: boolean;
  anticipoPct: number;
  cliente: string;
  director: string | null;
  direccion: string;
  presupuestoCodigo: string;
  presupuestoFecha: Date | null;
  originales: LineaCert[];
  adicionales: { codigo: string; lineas: LineaCert[] }[];
  /** Total de certificaciones anteriores del mismo alcance (para las parciales). */
  certificadoAnterior: number;
  pagos: { concepto: string; estado: EstadoCobro; importe: number; pendiente: number }[];
};

export const BLOQUES: DefBloque[] = [
  { id: "objeto", titulo: "Objeto" },
  { id: "adicionales", titulo: "Trabajos adicionales incorporados", ayuda: "Texto explicativo de los adicionales (se imprime antes de su tabla)." },
  { id: "pagos", titulo: "Situación de pagos (introducción)" },
  { id: "observaciones", titulo: "Observaciones", ayuda: "Un párrafo por línea; **negrita** para el título de cada uno." },
];

const suma = (ls: LineaCert[]) => Math.round(ls.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;

export function totales(d: DatosCertificacion) {
  const originales = suma(d.originales);
  const adicionales = suma(d.adicionales.flatMap((a) => a.lineas));
  const pendiente = Math.round(d.pagos.reduce((s, p) => s + p.pendiente, 0) * 100) / 100;
  return { originales, adicionales, total: Math.round((originales + adicionales) * 100) / 100, pendiente };
}

export function variables(d: DatosCertificacion): Record<string, string> {
  const anticipo = d.pagos.find((p) => p.concepto.startsWith("Anticipo"));
  return {
    cliente: d.cliente,
    direccion: d.direccion,
    director: d.director ?? "",
    presupuesto_codigo: d.presupuestoCodigo,
    anticipo_pct: String(d.anticipoPct),
    anticipo_monto: anticipo ? formatearMonto(anticipo.importe, d.moneda) : "",
    moneda_nombre: MONEDA_TEXTO[d.moneda],
    adicionales_codigos: d.adicionales.map((a) => a.codigo).join(", "),
  };
}

/** Textos por defecto (del Word de PAS). */
export function bloquesPorDefecto(d: DatosCertificacion): Record<string, string> {
  const anticipo = d.pagos.find((p) => p.concepto.startsWith("Anticipo"));
  const obra = d.alcance === "obra";
  return {
    objeto: obra
      ? `Por medio del presente documento, Piedra Angular Solutions (PAS) y {cliente} dejan constancia del estado de avance y de la situación de pagos correspondiente a los trabajos de perforación de hormigón armado con sistema diamantado ejecutados en la obra sita en {direccion}, conforme al Presupuesto Nro. {presupuesto_codigo}${d.adicionales.length ? ", e incorporan a la contratación los trabajos adicionales solicitados por la Contratista que se detallan a continuación" : ""}.`
      : "Por medio del presente documento, Piedra Angular Solutions (PAS) y {cliente} dejan constancia de la ejecución y de la situación de pagos de los trabajos adicionales {adicionales_codigos} realizados en la obra sita en {direccion}, complementarios al Presupuesto Nro. {presupuesto_codigo}.",
    adicionales: d.adicionales.length
      ? `A solicitud del Contratista se incorporan los trabajos adicionales {adicionales_codigos}, ejecutados con el mismo sistema de perforación diamantada y bajo idénticas condiciones técnicas y comerciales que las establecidas en el presupuesto de referencia.${d.bonificado ? " Se mantiene para estas unidades el valor unitario bonificado." : ""}`
      : "",
    pagos:
      anticipo && anticipo.estado === "abonado"
        ? "Se deja expresa constancia de que PAS ha percibido de conformidad el anticipo del {anticipo_pct}% correspondiente al presupuesto original, por un importe de {anticipo_monto}, quedando dicho concepto totalmente abonado. El detalle de la situación de pagos a la fecha de la presente certificación es el siguiente:"
        : "El detalle de la situación de pagos a la fecha de la presente certificación es el siguiente:",
    observaciones: [
      d.bonificado &&
        "**Vigencia del descuento comercial.** Los valores unitarios consignados en la presente certificación incluyen la bonificación comercial otorgada oportunamente en el Presupuesto Nro. {presupuesto_codigo}. Dicha bonificación se aplica exclusivamente a los trabajos certificados en este documento y queda sin efecto a partir de la firma del presente. En consecuencia, toda tarea adicional, ampliación de alcance o nueva contratación posterior será cotizada a los valores de lista vigentes a la fecha de ejecución, sin descuento aplicable.",
      d.bonificado &&
        "**Condición del beneficio.** El mantenimiento de la bonificación sobre el saldo aquí certificado queda sujeto a la cancelación de este dentro de los plazos convenidos. La mora en el pago habilitará a PAS a recalcular el saldo pendiente a valores de lista, con más la actualización que corresponda según Base CAC General.",
      `**Impuestos.** Los importes expresados en la presente certificación ${d.incluyeIva ? "incluyen" : "no incluyen"} IVA y se encuentran expresados en {moneda_nombre}.`,
      "**Forma de pago del saldo.** Medios de pago a coordinar entre las partes.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

const fila = (l: LineaCert, nro: number, moneda: Moneda) => ({
  nro: String(nro),
  descripcion: l.descripcion,
  cantidad: `${l.cantidad}${l.unidad === "u" ? "" : ` ${UNIDADES[l.unidad]}`}`,
  precio: formatearMonto(l.precioUnitario, moneda),
  subtotal: formatearMonto(l.subtotal, moneda),
});

export function armar(d: DatosCertificacion, bloques: Record<string, string>) {
  const vars = variables(d);
  const parrafos: Record<string, Parrafo[]> = Object.fromEntries(BLOQUES.map((b) => [b.id, parrafosDe(interpolar(bloques[b.id] ?? "", vars))]));
  const t = totales(d);
  const m = (n: number) => formatearMonto(n, d.moneda);
  const lineasAd = d.adicionales.flatMap((a) => a.lineas);
  const obra = d.alcance === "obra";
  return {
    codigo: d.codigo,
    fecha: fechaAR(d.fecha),
    cliente: d.cliente,
    director: d.director ?? "—",
    direccion: d.direccion,
    presupuesto_codigo: d.presupuestoCodigo,
    presupuesto_fecha: d.presupuestoFecha ? fechaAR(d.presupuestoFecha) : "—",
    titulo: `${obra ? "CERTIFICACIÓN DE OBRA" : "CERTIFICACIÓN DE TRABAJO ADICIONAL"}${d.tipo === "parcial" ? " (PARCIAL)" : ""}`,
    hay_originales: obra && d.originales.length > 0,
    originales: d.originales.map((l, i) => fila(l, i + 1, d.moneda)),
    subtotal_originales_label: `Subtotal trabajos originales${d.bonificado ? " con Descuento" : ""}`,
    subtotal_originales: m(t.originales),
    hay_adicionales: lineasAd.length > 0,
    adicionales_items: lineasAd.map((l, i) => fila(l, (obra ? d.originales.length : 0) + i + 1, d.moneda)),
    subtotal_adicionales: m(t.adicionales),
    total_certificado: m(t.total),
    total_detalle: [
      obra ? (lineasAd.length ? "(trabajos originales + adicionales)" : "(trabajos originales)") : "(trabajos adicionales)",
      d.certificadoAnterior > 0 && `Certificado anteriormente: ${m(d.certificadoAnterior)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    pagos_filas: d.pagos.map((p) => ({ concepto: p.concepto, estado: ESTADOS_COBRO[p.estado], abonado: p.estado === "abonado", importe: m(p.importe) })),
    saldo_total: m(t.pendiente),
    saldo_letras: montoEnLetras(t.pendiente, d.moneda),
    ...parrafos,
  };
}

export type DocCertificacion = ReturnType<typeof armar>;
