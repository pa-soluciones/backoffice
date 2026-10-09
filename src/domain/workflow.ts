// Workflow de estados por presupuesto (spec/05 §5). Función pura: el servicio solo ejecuta
// lo que esta tabla permite.

export const ESTADOS = {
  prospecto: "Prospecto",
  visita_tecnica: "Visita técnica",
  en_espera: "En espera",
  en_progreso: "En progreso",
  pendiente_liquidacion: "Pendiente liquidación",
  terminado: "Terminado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
} as const;
export type Estado = keyof typeof ESTADOS;

export const FINALES: Estado[] = ["terminado", "rechazado", "cancelado"];
export const esFinal = (e: Estado) => FINALES.includes(e);

/** Datos que la transición necesita del presupuesto y del formulario. */
export type Contexto = {
  requiereVisita: boolean;
  /** Visita realizada u omitida con motivo. */
  visitaResuelta: boolean;
  tieneEmitida: boolean;
  fechaConfirmacion?: string | null;
  motivo?: string | null;
  saldoPendiente?: number;
};

type Regla = { hasta: Estado; requiere?: (c: Contexto) => string | null };

const conMotivo = (c: Contexto) => (c.motivo?.trim() ? null : "Indicá el motivo.");

const REGLAS: Record<Estado, Regla[]> = {
  prospecto: [
    { hasta: "visita_tecnica", requiere: (c) => (c.requiereVisita ? null : "El presupuesto no requiere visita técnica.") },
    {
      hasta: "en_espera",
      requiere: (c) =>
        c.requiereVisita
          ? "Requiere visita técnica: pasalo primero a Visita técnica."
          : c.tieneEmitida
            ? null
            : "Emití el presupuesto antes de pasarlo a En espera.",
    },
  ],
  visita_tecnica: [
    {
      hasta: "en_espera",
      requiere: (c) =>
        !c.visitaResuelta
          ? "Marcá la visita como realizada u omitida."
          : c.tieneEmitida
            ? null
            : "Emití el presupuesto antes de pasarlo a En espera.",
    },
  ],
  en_espera: [
    { hasta: "en_progreso", requiere: (c) => (c.fechaConfirmacion ? null : "Indicá la fecha de confirmación del cliente.") },
    { hasta: "rechazado", requiere: conMotivo },
  ],
  // ponytail: el cierre de materiales (spec/08 RF-STK-05) se agrega como requisito en F7.
  en_progreso: [{ hasta: "pendiente_liquidacion" }],
  pendiente_liquidacion: [
    {
      hasta: "terminado",
      requiere: (c) => ((c.saldoPendiente ?? 0) <= 0 || c.motivo?.trim() ? null : "Hay saldo pendiente: indicá el motivo para cerrarlo igual."),
    },
  ],
  terminado: [],
  rechazado: [],
  cancelado: [],
};

/** Destinos posibles desde un estado (incluye Cancelado desde cualquier no final). */
export function destinos(desde: Estado): Estado[] {
  const base = REGLAS[desde].map((r) => r.hasta);
  return esFinal(desde) ? base : [...base, "cancelado"];
}

/** null si la transición es válida; si no, el motivo para mostrar al usuario. */
export function validarTransicion(desde: Estado, hasta: Estado, c: Contexto): string | null {
  if (hasta === "cancelado") return esFinal(desde) ? "El presupuesto ya está cerrado." : conMotivo(c);
  const regla = REGLAS[desde].find((r) => r.hasta === hasta);
  if (!regla) return `No se puede pasar de ${ESTADOS[desde]} a ${ESTADOS[hasta]}.`;
  return regla.requiere?.(c) ?? null;
}
