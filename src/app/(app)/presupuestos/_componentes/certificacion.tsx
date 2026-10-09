"use client";

import { FileCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccion } from "@/hooks/use-accion";
import { accionCrearCertificacion, accionEmitirCertificacion, accionParametrosCertificacion } from "../actions";

export function BotonNuevaCertificacion({ presupuestoId, adicionalId = null, children }: { presupuestoId: string; adicionalId?: string | null; children: React.ReactNode }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setError((await accionCrearCertificacion(presupuestoId, adicionalId))?.error))}>
        <FileCheck data-icon="inline-start" /> {children}
      </Button>
      <MensajeError error={error} />
    </span>
  );
}

type Item = { id: string; origen: string; descripcion: string; cotizado: number; ejecutado: number | null; cantidad: number };

/** Tipo (parcial/final), cantidades por ítem y adicionales incluidos (spec/06 §3.3). */
export function ParametrosCertificacion({
  presupuestoId,
  id,
  tipo,
  items,
  adicionales,
  incluidos,
}: {
  presupuestoId: string;
  id: string;
  tipo: "parcial" | "final";
  items: Item[];
  adicionales: { id: string; codigo: string }[];
  /** null = todos los aprobados. */
  incluidos: string[] | null;
}) {
  const [estado, onSubmit, pending] = useAccion(accionParametrosCertificacion.bind(null, presupuestoId, id), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-semibold">Tipo de certificación</legend>
        {(["parcial", "final"] as const).map((t) => (
          <label key={t} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="tipo" value={t} defaultChecked={tipo === t} className="size-4 accent-primary" />
            {t === "parcial" ? "Parcial" : "Final"}
          </label>
        ))}
      </fieldset>

      {adicionales.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-semibold">Adicionales aprobados incluidos</legend>
          <input type="hidden" name="conAdicionales" value="1" />
          {adicionales.map((a) => (
            <label key={a.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="adicional" value={a.id} defaultChecked={!incluidos || incluidos.includes(a.id)} className="size-4 accent-primary" />
              {a.codigo}
            </label>
          ))}
        </fieldset>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-semibold">Cantidades a certificar</caption>
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2 font-semibold">Ítem</th>
              <th className="p-2 text-right font-semibold">Cotizado</th>
              <th className="p-2 text-right font-semibold">Ejecutado</th>
              <th className="p-2 text-right font-semibold">Certificar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="p-2">
                  <span className="block text-xs text-muted-foreground">{i.origen}</span>
                  {i.descripcion}
                </td>
                <td className="p-2 text-right tabular-nums">{i.cotizado}</td>
                <td className="p-2 text-right tabular-nums">{i.ejecutado ?? "—"}</td>
                <td className="p-2 text-right">
                  <Input
                    name={`cant_${i.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={i.cotizado}
                    step="0.01"
                    defaultValue={i.cantidad}
                    aria-label={`Cantidad a certificar: ${i.descripcion}`}
                    className="ml-auto h-10 w-24 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">Por defecto, lo ejecutado según los registros de campo (con tope en lo cotizado); si no hay registros, lo cotizado.</p>
      </div>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          Guardado.
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        Aplicar
      </Button>
    </form>
  );
}

export function EmitirCertificacion({ presupuestoId, id }: { presupuestoId: string; id: string }) {
  const [r, setR] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("¿Emitir la certificación? Se genera el documento y ya no se puede modificar.")) return;
          start(async () => setR(await accionEmitirCertificacion(presupuestoId, id)));
        }}
      >
        {pending ? "Emitiendo…" : "Emitir certificación"}
      </Button>
      <MensajeError error={r?.error} />
    </div>
  );
}
