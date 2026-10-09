"use client";

import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { accionEliminar, accionEmitir, accionNuevaRevision } from "../actions";

export function BotonesRevision({ id, puedeEmitir, puedeNueva, puedeEliminar }: { id: string; puedeEmitir: boolean; puedeNueva: boolean; puedeEliminar: boolean }) {
  const [estado, setEstado] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string; ok?: string } | undefined>, confirmacion?: string) => {
    if (confirmacion && !confirm(confirmacion)) return;
    start(async () => setEstado(await fn()));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {puedeEmitir && (
          <Button type="button" disabled={pending} onClick={() => run(() => accionEmitir(id), "¿Emitir el presupuesto? Después no se puede modificar: solo con una nueva revisión.")}>
            Emitir presupuesto
          </Button>
        )}
        {puedeNueva && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => accionNuevaRevision(id))}>
            Nueva revisión
          </Button>
        )}
        {puedeEliminar && (
          <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => accionEliminar(id), "¿Eliminar este presupuesto?")}>
            Eliminar
          </Button>
        )}
      </div>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
    </div>
  );
}
