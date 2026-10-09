"use client";

import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionCifrasReporte, accionCrearReporte, accionEmitirReporte } from "../actions";

/** Mes anterior (lo habitual: el día 1 se reporta el mes que terminó). */
const mesAnterior = () => {
  const [a, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
};

export function NuevoReporte({ presupuestoId }: { presupuestoId: string }) {
  const [estado, onSubmit, pending] = useAccion(accionCrearReporte.bind(null, presupuestoId), undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <Campo id="reporte-periodo" label="Mes a reportar" name="periodo" type="month" required defaultValue={mesAnterior()} />
      <Button type="submit" disabled={pending}>
        Preparar reporte
      </Button>
      <MensajeError error={estado?.error} />
    </form>
  );
}

export function CifrasReporte({ presupuestoId, id, c }: { presupuestoId: string; id: string; c: { trabajadores: number; dias: number; accidentes: number; diasPerdidos: number } }) {
  const [estado, onSubmit, pending] = useAccion(accionCifrasReporte.bind(null, presupuestoId, id), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo label="Cantidad de trabajadores" name="trabajadores" type="number" min={0} step={1} required defaultValue={c.trabajadores} />
        <Campo label="Días trabajados" name="dias" type="number" min={0} max={31} step={1} required defaultValue={c.dias} />
        <Campo label="Cantidad de accidentes" name="accidentes" type="number" min={0} step={1} required defaultValue={c.accidentes} />
        <Campo label="Días perdidos por accidentes" name="diasPerdidos" type="number" min={0} step={1} required defaultValue={c.diasPerdidos} />
      </div>
      <p className="text-xs text-muted-foreground">Trabajadores y días vienen de los registros de campo y las jornadas del mes; corregilos si hace falta.</p>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          Guardado.
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        Guardar cifras
      </Button>
    </form>
  );
}

export function EmitirReporte({ presupuestoId, id }: { presupuestoId: string; id: string }) {
  const [r, setR] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => confirm("¿Emitir el reporte? Ya no se va a poder modificar.") && start(async () => setR(await accionEmitirReporte(presupuestoId, id)))}
      >
        {pending ? "Emitiendo…" : "Emitir reporte"}
      </Button>
      <MensajeError error={r?.error} />
    </div>
  );
}
