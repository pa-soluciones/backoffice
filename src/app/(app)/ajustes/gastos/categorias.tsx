"use client";

import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccion } from "@/hooks/use-accion";
import { accionCategoriaGasto } from "../actions";

export function FilaCategoria({ id, nombre, activa }: { id: string | null; nombre: string; activa: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionCategoriaGasto.bind(null, id), undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 p-3">
      <Input name="nombre" defaultValue={nombre} required maxLength={60} aria-label={id ? `Nombre de ${nombre}` : "Nueva categoría"} placeholder="Nueva categoría" className="h-10 min-w-0 flex-1" />
      {id && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activa" defaultChecked={activa} className="size-4 accent-primary" />
          Activa
        </label>
      )}
      <Button type="submit" size="sm" variant={id ? "outline" : "default"} disabled={pending}>
        {id ? "Guardar" : "Agregar"}
      </Button>
      <MensajeError error={estado?.error} />
    </form>
  );
}
