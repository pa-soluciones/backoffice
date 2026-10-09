// Estados de un trabajo adicional (spec/05 RF-ADI-02).

export type EstadoAdicional = "borrador" | "enviado" | "aprobado" | "rechazado" | "cancelado";

export const ESTADOS_ADICIONAL: Record<EstadoAdicional, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

/** Borrador → (emitir) Enviado → Aprobado | Rechazado; se puede cancelar mientras no esté resuelto. */
export const TRANSICIONES_ADICIONAL: Record<EstadoAdicional, EstadoAdicional[]> = {
  borrador: ["cancelado"],
  enviado: ["aprobado", "rechazado", "cancelado"],
  aprobado: [],
  rechazado: [],
  cancelado: [],
};
