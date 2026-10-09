// Cálculo de totales (spec/05 RF-PRE-02/03). Se trabaja en centavos enteros para no arrastrar
// errores de coma flotante; redondeo half-up a 2 decimales por línea.

export type Moneda = "ARS" | "USD";
export type Bonificacion = { tipo: "pct" | "monto"; valor: number } | null;

export type LineaEntrada = { cantidad: number; precioUnitario: number };
export type Linea = { precioUnitario: number; subtotal: number };

export type Totales = {
  lineas: Linea[];
  subtotal: number;
  /** Solo para bonificación de monto fijo (la de % ya está aplicada al precio unitario). */
  bonificacionMonto: number;
  neto: number;
  iva: number;
  total: number;
};

const aCentavos = (n: number) => Math.round((n + Number.EPSILON) * 100);
const aPesos = (c: number) => c / 100;

export function calcularTotales(
  items: LineaEntrada[],
  opts: { bonificacion: Bonificacion; incluyeIva: boolean; ivaPct: number },
): Totales {
  const pct = opts.bonificacion?.tipo === "pct" ? opts.bonificacion.valor : 0;

  const lineas = items.map((it) => {
    const puCent = Math.round(aCentavos(it.precioUnitario) * (1 - pct / 100));
    return { puCent, subCent: Math.round(puCent * it.cantidad) };
  });
  const subtotal = lineas.reduce((a, l) => a + l.subCent, 0);
  const bonif = opts.bonificacion?.tipo === "monto" ? Math.min(aCentavos(opts.bonificacion.valor), subtotal) : 0;
  const neto = subtotal - bonif;
  const iva = opts.incluyeIva ? Math.round((neto * opts.ivaPct) / 100) : 0;

  return {
    lineas: lineas.map((l) => ({ precioUnitario: aPesos(l.puCent), subtotal: aPesos(l.subCent) })),
    subtotal: aPesos(subtotal),
    bonificacionMonto: aPesos(bonif),
    neto: aPesos(neto),
    iva: aPesos(iva),
    total: aPesos(neto + iva),
  };
}

/** Anticipo sobre el total (spec/05: 40% por defecto). */
export function anticipo(total: number, pct: number) {
  return aPesos(Math.round((aCentavos(total) * pct) / 100));
}

const fmt = {
  ARS: new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/** "$ 1.512.000,00" / "US$ 1.250,00" (spec/12 RNF-29). */
export function formatearMonto(n: number, moneda: Moneda = "ARS") {
  return `${moneda === "USD" ? "US$" : "$"} ${fmt[moneda].format(n)}`;
}
