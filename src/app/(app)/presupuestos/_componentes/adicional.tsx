"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ESTADOS_ADICIONAL, TRANSICIONES_ADICIONAL, type EstadoAdicional } from "@/domain/adicionales";
import { useAccion } from "@/hooks/use-accion";
import { accionCondicionesAdicional, accionCrearAdicional, accionEmitirAdicional, accionEstadoAdicional } from "../actions";

export function BotonCrearAdicional({ presupuestoId }: { presupuestoId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setError((await accionCrearAdicional(presupuestoId))?.error))}>
        <Plus data-icon="inline-start" /> Adicional
      </Button>
      <MensajeError error={error} />
    </span>
  );
}

export function CondicionesAdicional({
  presupuestoId,
  id,
  validezDias,
  anticipoPct,
  mantieneBonificacion,
  bonifPct,
}: {
  presupuestoId: string;
  id: string;
  validezDias: number;
  anticipoPct: number;
  mantieneBonificacion: boolean;
  bonifPct: number | null;
}) {
  const [estado, onSubmit, pending] = useAccion(accionCondicionesAdicional.bind(null, presupuestoId, id), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Campo label="Validez de la cotización (días)" name="validezDias" type="number" min={1} defaultValue={validezDias} required />
        <Campo label="Anticipo (%)" name="anticipoPct" type="number" min={0} max={100} step="0.01" defaultValue={anticipoPct} required ayuda="Por defecto 0: se cobra todo contra certificación." />
        {bonifPct != null && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="mantieneBonificacion" defaultChecked={mantieneBonificacion} className="size-4 accent-primary" />
            Mantener la bonificación del presupuesto ({bonifPct}% sobre el valor unitario)
          </label>
        )}
      </div>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          Guardado.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Guardar condiciones
      </Button>
    </form>
  );
}

export function AccionesAdicional({ presupuestoId, id, estado: actual, puedeEmitir }: { presupuestoId: string; id: string; estado: EstadoAdicional; puedeEmitir: boolean }) {
  const [emision, setEmision] = useState<{ error?: string; ok?: string }>();
  const [emitiendo, start] = useTransition();
  const [estado, onSubmit, pending] = useAccion(accionEstadoAdicional.bind(null, presupuestoId, id), undefined);
  const [hasta, setHasta] = useState<EstadoAdicional | "">("");
  const destinos = TRANSICIONES_ADICIONAL[actual];

  return (
    <div className="space-y-4">
      {actual === "borrador" && puedeEmitir && (
        <Button
          type="button"
          disabled={emitiendo}
          onClick={() => {
            if (!confirm("¿Emitir el adicional? Se genera el documento y ya no se puede modificar.")) return;
            start(async () => setEmision(await accionEmitirAdicional(presupuestoId, id)));
          }}
        >
          {emitiendo ? "Emitiendo…" : "Emitir adicional"}
        </Button>
      )}
      {/* Fuera del bloque de borrador: después de emitir la página ya muestra "Enviado". */}
      <MensajeError error={emision?.error} />
      {emision?.ok && (
        <p role="status" className="text-sm text-success">
          {emision.ok}
        </p>
      )}
      {destinos.length > 0 && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="hasta-ad">Estado del adicional</Label>
            <select
              id="hasta-ad"
              name="hasta"
              required
              value={hasta}
              onChange={(e) => setHasta(e.target.value as EstadoAdicional)}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm"
            >
              <option value="">Elegí el nuevo estado…</option>
              {destinos.map((d) => (
                <option key={d} value={d}>
                  {d === "aprobado" ? "Aprobado por el cliente" : ESTADOS_ADICIONAL[d]}
                </option>
              ))}
            </select>
          </div>
          {(hasta === "rechazado" || hasta === "cancelado") && <AreaTexto label="Motivo" name="motivo" required rows={2} />}
          <MensajeError error={estado?.error} />
          <Button type="submit" variant="outline" disabled={pending || !hasta}>
            Cambiar estado
          </Button>
        </form>
      )}
    </div>
  );
}
