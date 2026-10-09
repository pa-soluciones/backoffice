"use client";

import { FileText } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionAlcanceControl, accionCrearControl, accionEmitirControl } from "../actions";

export function BotonNuevoControl({ presupuestoId }: { presupuestoId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setError((await accionCrearControl(presupuestoId))?.error))}>
        <FileText data-icon="inline-start" /> Control de perforaciones
      </Button>
      <MensajeError error={error} />
    </span>
  );
}

/** Período de registros que abarca el control (spec/06 §3.5: rango de fechas o todo lo ejecutado). */
export function AlcanceControl({ presupuestoId, id, desde, hasta }: { presupuestoId: string; id: string; desde: string | null; hasta: string | null }) {
  const [estado, onSubmit, pending] = useAccion(accionAlcanceControl.bind(null, presupuestoId, id), undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <Campo label="Registros desde" name="desde" type="date" defaultValue={desde ?? ""} />
      <Campo label="Hasta" name="hasta" type="date" defaultValue={hasta ?? ""} />
      <Button type="submit" variant="outline" disabled={pending}>
        Aplicar período
      </Button>
      <p className="w-full text-xs text-muted-foreground">Sin fechas, el control incluye todo lo ejecutado.</p>
      <MensajeError error={estado?.error} />
    </form>
  );
}

export function EmitirControl({ presupuestoId, id }: { presupuestoId: string; id: string }) {
  const [r, setR] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("¿Emitir el control? Se genera el documento con los registros actuales y ya no se puede modificar.")) return;
          start(async () => setR(await accionEmitirControl(presupuestoId, id)));
        }}
      >
        {pending ? "Emitiendo…" : "Emitir control"}
      </Button>
      <MensajeError error={r?.error} />
      {r?.ok && (
        <p role="status" className="text-sm text-success">
          {r.ok}
        </p>
      )}
    </div>
  );
}
