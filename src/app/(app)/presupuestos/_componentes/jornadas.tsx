"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Plegable } from "@/components/plegable";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionEliminarJornada, accionPlanificarJornada } from "../actions";

type Jornada = { id: string; fecha: string; notas: string | null; operarios: string[] };
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

/** Jornadas de trabajo planificadas (spec/05 RF-AGE-05). */
export function Jornadas({ presupuestoId, jornadas, usuarios, editable }: { presupuestoId: string; jornadas: Jornada[]; usuarios: { id: string; name: string }[]; editable: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionPlanificarJornada.bind(null, presupuestoId), undefined);
  return (
    <div className="space-y-3">
      {jornadas.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin jornadas planificadas.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {jornadas.map((j) => (
            <FilaJornada key={j.id} presupuestoId={presupuestoId} j={j} editable={editable} />
          ))}
        </ul>
      )}
      {editable && (
        <Plegable titulo="Nueva jornada">
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="jornada-fecha" label="Fecha" name="fecha" type="date" required min={hoyAR()} />
            <Campo id="jornada-notas" label="Notas" name="notas" maxLength={300} placeholder="Pisos 10 al 6, llevar grupo electrógeno" />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold">Operarios</legend>
            <div className="flex flex-wrap gap-2">
              {usuarios.map((u) => (
                <label key={u.id} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                  <input type="checkbox" name="operarios" value={u.id} className="size-4 accent-primary" />
                  {u.name}
                </label>
              ))}
            </div>
          </fieldset>
          <MensajeError error={estado?.error} />
          <Button type="submit" disabled={pending}>
            Planificar
          </Button>
        </form>
        </Plegable>
      )}
    </div>
  );
}

function FilaJornada({ presupuestoId, j, editable }: { presupuestoId: string; j: Jornada; editable: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold capitalize">{dia(j.fecha)}</span>
        <span className="block text-xs text-muted-foreground">{[j.operarios.join(", "), j.notas].filter(Boolean).join(" · ")}</span>
      </span>
      {editable && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Eliminar jornada del ${dia(j.fecha)}`}
          onClick={() => confirm("¿Eliminar la jornada?") && start(async () => setError((await accionEliminarJornada(presupuestoId, j.id))?.error))}
        >
          <Trash2 />
        </Button>
      )}
      <MensajeError error={error} />
    </li>
  );
}
