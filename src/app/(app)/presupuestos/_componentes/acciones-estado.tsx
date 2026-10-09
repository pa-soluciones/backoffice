"use client";

import { useState } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { ESTADOS, type Estado } from "@/domain/workflow";
import { accionCambiarEstado, accionReabrir } from "../actions";

const PIDE_MOTIVO: Estado[] = ["rechazado", "cancelado", "terminado"];

/** Cambio de estado: elige destino y pide solo los datos que esa transición exige. */
export function AccionesEstado({ id, destinos, hoy }: { id: string; destinos: Estado[]; hoy: string }) {
  const [estado, onSubmit, pending] = useAccion(accionCambiarEstado.bind(null, id), undefined);
  const [hasta, setHasta] = useState<Estado | "">("");

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="hasta">Pasar a</Label>
        <select
          id="hasta"
          name="hasta"
          required
          value={hasta}
          onChange={(e) => setHasta(e.target.value as Estado)}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm"
        >
          <option value="">Elegí el nuevo estado…</option>
          {destinos.map((d) => (
            <option key={d} value={d}>
              {ESTADOS[d]}
            </option>
          ))}
        </select>
      </div>
      {hasta === "en_progreso" && <Campo label="Fecha de confirmación del cliente" name="fechaConfirmacion" type="date" defaultValue={hoy} max={hoy} required />}
      {hasta && PIDE_MOTIVO.includes(hasta) && (
        <AreaTexto
          label={hasta === "terminado" ? "Motivo (si queda saldo pendiente)" : "Motivo"}
          name="motivo"
          required={hasta !== "terminado"}
          rows={2}
        />
      )}
      <MensajeError error={estado?.error} />
      <Button type="submit" className="w-full" disabled={pending || !hasta}>
        {pending ? "Guardando…" : "Cambiar estado"}
      </Button>
    </form>
  );
}

export function Reabrir({ id }: { id: string }) {
  const [estado, onSubmit, pending] = useAccion(accionReabrir.bind(null, id), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <AreaTexto label="Motivo para reabrir" name="motivo" required rows={2} />
      <MensajeError error={estado?.error} />
      <Button type="submit" variant="outline" disabled={pending}>
        Reabrir presupuesto
      </Button>
    </form>
  );
}
