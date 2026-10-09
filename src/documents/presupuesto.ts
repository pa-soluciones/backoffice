// Documento "Presupuesto" (spec/06 §3.1): datos bloqueados (de la base) + bloques editables.
// Puro: no toca la base. Lo usan la vista previa HTML y la generación del DOCX.

import { interpolar, parrafosDe, type Parrafo } from "@/domain/bloques";
import { UNIDADES, type TipoServicio, type Unidad } from "@/domain/items";
import { formatearMonto, type Bonificacion, type Moneda, type Totales } from "@/domain/montos";

export type DatosPresupuesto = {
  codigo: string;
  fecha: Date;
  moneda: Moneda;
  validezDias: number;
  baseAjuste: string;
  formaContratacion: string;
  anticipoPct: number;
  incluyeIva: boolean;
  ivaPct: number;
  bonificacion: Bonificacion;
  cliente: string;
  director: string | null;
  direccion: string;
  items: {
    descripcion: string;
    cantidad: number;
    unidad: Unidad;
    precioUnitario: number;
    tipoServicio: TipoServicio;
    elemento: string | null;
    diametroMm: number | null;
    espesorCm: number | null;
  }[];
  totales: Totales;
};

export type DefBloque = { id: string; titulo: string; ayuda?: string };

/** Orden y títulos de los bloques editables, como aparecen en el documento. */
export const BLOQUES: DefBloque[] = [
  { id: "introduccion", titulo: "Introducción" },
  { id: "descripcion", titulo: "Descripción técnica del trabajo" },
  { id: "cotizacion", titulo: "Cotización" },
  { id: "responsabilidades_intro", titulo: "Responsabilidades del cliente (introducción)" },
  { id: "responsabilidades", titulo: "Responsabilidades del cliente", ayuda: "Una responsabilidad por línea (se imprimen con viñetas)." },
  { id: "plazos", titulo: "Plazos de ejecución", ayuda: "Una línea por plazo." },
  { id: "forma_pago", titulo: "Forma de pago" },
  { id: "garantia", titulo: "Garantía" },
  { id: "notas", titulo: "Notas adicionales" },
];

export const fechaAR = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(d);

const MONEDA: Record<Moneda, string> = { ARS: "Pesos argentinos (ARS)", USD: "Dólares estadounidenses (USD)" };
export const MONEDA_TEXTO: Record<Moneda, string> = { ARS: "pesos argentinos", USD: "dólares estadounidenses" };

export function variables(d: DatosPresupuesto): Record<string, string> {
  return {
    cliente: d.cliente,
    direccion: d.direccion,
    director: d.director ?? "",
    validez_dias: String(d.validezDias),
    anticipo_pct: String(d.anticipoPct),
    base_ajuste: d.baseAjuste,
    forma_contratacion: d.formaContratacion,
    moneda_nombre: MONEDA_TEXTO[d.moneda],
  };
}

const NOMBRES: Record<TipoServicio, [string, string]> = {
  perforacion: ["perforación", "perforaciones"],
  corte: ["corte", "cortes"],
  sellado_juntas: ["sellado de juntas", "sellados de juntas"],
  boca_ataque: ["boca de ataque", "bocas de ataque"],
  anclaje: ["anclaje", "anclajes"],
  mano_obra: ["servicio de mano de obra", "servicios de mano de obra"],
  otro: ["trabajo", "trabajos"],
};

/** "9 perforaciones de Ø 152 mm sobre viga de 29 cm de espesor y 4 cortes…" */
export function resumenItems(items: DatosPresupuesto["items"]) {
  const partes = items.map((i) => {
    const [uno, varios] = NOMBRES[i.tipoServicio] ?? NOMBRES.otro;
    const cant = i.unidad === "u" ? `${i.cantidad} ${i.cantidad === 1 ? uno : varios}` : `${i.cantidad} ${UNIDADES[i.unidad]} de ${uno}`;
    const det = [i.diametroMm && `de Ø ${i.diametroMm} mm`, i.elemento && `sobre ${i.elemento.toLowerCase()}`, i.espesorCm && `de ${i.espesorCm} cm de espesor`]
      .filter(Boolean)
      .join(" ");
    return `${cant}${det ? ` ${det}` : ""}`;
  });
  if (!partes.length) return "los trabajos detallados a continuación";
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/** Textos por defecto (tomados del Word original de PAS). */
export function bloquesPorDefecto(d: DatosPresupuesto): Record<string, string> {
  return {
    introduccion:
      "Estimados Sres. {cliente}, en respuesta a su solicitud, presentamos la propuesta técnica para la ejecución de perforaciones de H°A° con sistema diamantado, garantizando calidad y cumplimiento en los plazos establecidos.",
    descripcion: `El trabajo por ejecutar contempla la realización de ${resumenItems(d.items)}. Para su ejecución se aplicará sistema de perforación diamantada, asegurando precisión dimensional y un corte limpio en cada punto intervenido, sin generar vibraciones ni afectar la integridad estructural de los elementos.`,
    cotizacion:
      "La contratación de esta oferta se realizará por {forma_contratacion}. La actualización de precios se regirá por Base {base_ajuste} vigente a la fecha de ejecución. **Cotización válida por {validez_dias} días corridos desde la fecha de emisión.**",
    responsabilidades_intro: "Para la correcta ejecución de los trabajos cotizados, el cliente/consorcio deberá:",
    responsabilidades: [
      "Realizar el replanteo y marcación de los pases y/o cortes a ejecutar, libres de interferencias.",
      "Garantizar el acceso libre y seguro a los sectores donde se realizarán las tareas.",
      "Proveer energía eléctrica adecuada (2 tomas 220V – 20A) y suministro de agua a presión para el uso de los equipos.",
      "En caso de ser necesario, proveer y/o armar andamios y sistemas de apuntalamiento requeridos para el desarrollo de las tareas. Gestionar el traslado vertical de equipos, si aplica.",
      "Proporcionar asistencia de gremio necesario para la ejecución de la tarea. Encargarse de la limpieza final del área de trabajo una vez concluidas las tareas.",
    ].join("\n"),
    plazos: [
      "**Plazo estimado de inicio:** A coordinar con orden de compra y anticipo acreditado.",
      "**Horario de trabajo:** A convenir.",
      "**Plazo de ejecución:** Según magnitud y condiciones de la obra, a convenir.",
    ].join("\n"),
    forma_pago:
      "{anticipo_pct}% de anticipo al confirmar el trabajo y el saldo restante contra finalización de las tareas. Medios de pago a coordinar.",
    garantia: "Garantía de mano de obra hasta la finalización de los trabajos.",
    notas:
      "Cualquier trabajo adicional no contemplado en este presupuesto será cotizado y autorizado previamente por el cliente. La ejecución queda sujeta a disponibilidad de agenda y coordinación.",
  };
}

/** Leyenda de impuestos/moneda: autogenerada, no editable (spec/06 §3.1). */
export function leyenda(d: DatosPresupuesto) {
  const partes = [
    d.totales.bonificacionMonto > 0 ? `Incluye una bonificación de ${formatearMonto(d.totales.bonificacionMonto, d.moneda)}.` : null,
    d.incluyeIva
      ? `El total incluye IVA ${d.ivaPct}% (${formatearMonto(d.totales.iva, d.moneda)}): ${formatearMonto(d.totales.total, d.moneda)}.`
      : "El valor cotizado no incluye IVA.",
    `El precio indicado está expresado en ${MONEDA_TEXTO[d.moneda]}.`,
  ];
  return `**${partes.filter(Boolean).join(" ")}**`;
}

/** Datos listos para la vista previa y para docxtemplater. */
export function armar(d: DatosPresupuesto, bloques: Record<string, string>) {
  const vars = variables(d);
  const texto = (id: string) => interpolar(bloques[id] ?? "", vars);
  const parrafos: Record<string, Parrafo[]> = Object.fromEntries(BLOQUES.map((b) => [b.id, parrafosDe(texto(b.id))]));
  const items = d.items.map((i, n) => ({
    nro: String(n + 1),
    descripcion: i.descripcion,
    cantidad: `${i.cantidad}${i.unidad === "u" ? "" : ` ${UNIDADES[i.unidad]}`}`,
    precio: formatearMonto(d.totales.lineas[n]?.precioUnitario ?? i.precioUnitario, d.moneda),
    subtotal: formatearMonto(d.totales.lineas[n]?.subtotal ?? 0, d.moneda),
  }));
  return {
    codigo: d.codigo,
    fecha: fechaAR(d.fecha),
    moneda: MONEDA[d.moneda],
    validez: `${d.validezDias} días`,
    base_ajuste: d.baseAjuste,
    forma_contratacion: d.formaContratacion,
    cliente: d.cliente,
    director: d.director ?? "—",
    direccion: d.direccion,
    items,
    total: formatearMonto(d.totales.neto, d.moneda),
    leyenda: parrafosDe(leyenda(d)),
    ...parrafos,
  };
}

export type DocPresupuesto = ReturnType<typeof armar>;
