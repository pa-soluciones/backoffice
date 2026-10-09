"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { formatearMonto, type Moneda } from "@/domain/montos";
import { accionEliminarGasto } from "../../campo/actions";

type Gasto = { id: string; fecha: string; categoria: string; descripcion: string; importe: number; moneda: Moneda; tipoCambio: number | null; autor: string | null; obra?: string | null; presupuestoId: string | null };

const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function ListaGastos({ gastos, puedeEliminar }: { gastos: Gasto[]; puedeEliminar: boolean }) {
  if (!gastos.length) return <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin gastos cargados.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card text-sm">
      {gastos.map((g) => (
        <FilaGasto key={g.id} g={g} puedeEliminar={puedeEliminar} />
      ))}
    </ul>
  );
}

function FilaGasto({ g, puedeEliminar }: { g: Gasto; puedeEliminar: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{g.descripcion}</span>
        <span className="block text-xs text-muted-foreground">{[dia(g.fecha), g.categoria, g.obra, g.autor].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="tabular-nums">
        {formatearMonto(g.importe, g.moneda)}
        {g.tipoCambio && <span className="block text-right text-xs text-muted-foreground">TC {g.tipoCambio}</span>}
      </span>
      {puedeEliminar && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Eliminar gasto ${g.descripcion}`}
          onClick={() => confirm(`¿Eliminar el gasto "${g.descripcion}"?`) && start(async () => setError((await accionEliminarGasto(g.id, g.presupuestoId)).error))}
        >
          <Trash2 />
        </Button>
      )}
      <MensajeError error={error} />
    </li>
  );
}
