// "¿Qué sigue con este presupuesto?": una sola indicación, la más urgente, para destacar en el
// detalle. Sin DB.

import type { Estado } from "./workflow";

export type ContextoPaso = {
  estado: Estado;
  tieneItems: boolean;
  borrador: boolean;
  requiereVisita: boolean;
  visitaResuelta: boolean;
  visitaAgendada: boolean;
  ofertaVencida: boolean;
  /** Perforaciones ejecutadas de más, sin adicional. */
  excedente: number;
  anticipoPendiente: boolean;
  porCobrar: number;
  materialesEnObra: number;
};

export type Paso = { tono: "accion" | "alerta" | "info" | "ok"; texto: string; pestana?: "presupuesto" | "obra" | "dinero" };

export function siguientePaso(c: ContextoPaso): Paso | null {
  switch (c.estado) {
    case "prospecto":
      if (c.requiereVisita && !c.visitaAgendada && !c.visitaResuelta) return { tono: "accion", texto: "Agendá la visita técnica.", pestana: "presupuesto" };
      if (!c.tieneItems) return { tono: "accion", texto: "Cargá los ítems a cotizar.", pestana: "presupuesto" };
      if (c.borrador) return { tono: "accion", texto: "Revisá los textos y emití el presupuesto.", pestana: "presupuesto" };
      return { tono: "accion", texto: "Pasalo a En espera mientras el cliente decide." };
    case "visita_tecnica":
      return c.visitaResuelta
        ? { tono: "accion", texto: c.borrador ? "Cargá los ítems y emití el presupuesto." : "Pasalo a En espera.", pestana: "presupuesto" }
        : { tono: "accion", texto: "Registrá el resultado de la visita técnica.", pestana: "presupuesto" };
    case "en_espera":
      return c.ofertaVencida
        ? { tono: "alerta", texto: "La oferta venció: contactá al cliente o emití una revisión.", pestana: "presupuesto" }
        : { tono: "info", texto: "Esperando la respuesta del cliente." };
    case "en_progreso":
      if (c.excedente > 0) return { tono: "alerta", texto: `${c.excedente} perforaciones ejecutadas sin cotizar: cubrilas con un adicional.`, pestana: "obra" };
      if (c.anticipoPendiente) return { tono: "alerta", texto: "El anticipo todavía no se cobró.", pestana: "dinero" };
      return { tono: "info", texto: c.materialesEnObra ? "Obra en curso. Al terminar, hacé el cierre de materiales." : "Obra en curso: registrá el avance en Campo.", pestana: "obra" };
    case "pendiente_liquidacion":
      return c.porCobrar > 0 ? { tono: "alerta", texto: "Falta cobrar el saldo.", pestana: "dinero" } : { tono: "ok", texto: "Todo cobrado: ya se puede cerrar." };
    default:
      return null;
  }
}
