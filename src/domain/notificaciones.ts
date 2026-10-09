// Notificaciones (spec/09): eventos, canales por defecto y preferencias por categoría. Sin DB.

export type Canal = "push" | "email";

export const CATEGORIAS = {
  presupuestos: "Presupuestos (estados, asignaciones, documentos)",
  agenda: "Agenda (visitas y jornadas)",
  cobros: "Cobros y saldos",
  campo: "Campo (excedentes)",
  stock: "Stock",
  recordatorios: "Recordatorios",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

type DefEvento = { categoria: Categoria; canales: Canal[] };

/** Tabla de spec/09 §2: in-app siempre; estos son los canales extra por defecto. */
export const EVENTOS = {
  nuevo_prospecto: { categoria: "presupuestos", canales: ["push"] },
  asignacion: { categoria: "presupuestos", canales: ["push", "email"] },
  cambio_estado: { categoria: "presupuestos", canales: ["push"] },
  documento_emitido: { categoria: "presupuestos", canales: [] },
  visita_agendada: { categoria: "agenda", canales: ["push", "email"] },
  recordatorio_visita: { categoria: "agenda", canales: ["push", "email"] },
  recordatorio_jornada: { categoria: "agenda", canales: ["push"] },
  oferta_vencida: { categoria: "recordatorios", canales: ["push"] },
  en_espera_sin_respuesta: { categoria: "recordatorios", canales: [] },
  anticipo_pendiente: { categoria: "cobros", canales: ["email"] },
  saldo_pendiente: { categoria: "cobros", canales: ["email"] },
  cobro_registrado: { categoria: "cobros", canales: [] },
  excedente: { categoria: "campo", canales: ["push"] },
  stock_bajo: { categoria: "stock", canales: [] },
  reporte_mensual: { categoria: "recordatorios", canales: ["push"] },
  sincronizacion: { categoria: "campo", canales: [] },
} as const satisfies Record<string, DefEvento>;
export type TipoEvento = keyof typeof EVENTOS;

/** Preferencias del usuario: por categoría, qué canales extra recibe (sin dato = los del evento). */
export type Preferencias = Partial<Record<Categoria, Partial<Record<Canal, boolean>>>>;

export function canales(tipo: TipoEvento, prefs: Preferencias | null | undefined): Canal[] {
  const ev = EVENTOS[tipo];
  const p = prefs?.[ev.categoria];
  return (["push", "email"] as const).filter((c) => p?.[c] ?? (ev.canales as readonly Canal[]).includes(c));
}

/** Ventana de agrupación (RF-NOT-04). */
export const AGRUPAR_MS = 10 * 60_000;

/** "Cambio de estado" agrupado: "(3) Nuevos registros de campo en 2026/0105". */
export const tituloAgrupado = (titulo: string, n: number) => (n > 1 ? `(${n}) ${titulo}` : titulo);
