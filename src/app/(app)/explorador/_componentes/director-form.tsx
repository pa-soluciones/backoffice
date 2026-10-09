"use client";

import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionGuardarDirector } from "../actions";

type Director = { id: string; nombre: string; telefono: string | null; email: string | null; empresa: string | null; notas: string | null };

export function DirectorForm({ director }: { director?: Director }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarDirector, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {director && <input type="hidden" name="id" value={director.id} />}
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Campo label="Nombre y apellido" name="nombre" defaultValue={director?.nombre} required autoFocus={!director} className="sm:col-span-2" />
        <Campo label="Teléfono (opcional)" name="telefono" type="tel" defaultValue={director?.telefono ?? ""} />
        <Campo label="Email (opcional)" name="email" type="email" defaultValue={director?.email ?? ""} />
        <Campo label="Empresa / estudio (opcional)" name="empresa" defaultValue={director?.empresa ?? ""} className="sm:col-span-2" />
        <AreaTexto label="Notas (opcional)" name="notas" defaultValue={director?.notas ?? ""} className="sm:col-span-2" />
      </div>
      <MensajeError error={estado?.error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : director ? "Guardar cambios" : "Crear director"}
      </Button>
    </form>
  );
}
