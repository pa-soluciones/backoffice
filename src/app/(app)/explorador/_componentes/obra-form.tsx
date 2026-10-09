"use client";

import { useState } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionGuardarObra } from "../actions";

type Obra = {
  id: string;
  nombre: string | null;
  direccion: string;
  localidad: string | null;
  provincia: string | null;
  directorId: string | null;
  hysNombre: string | null;
  notas: string | null;
};
type Director = { id: string; nombre: string; empresa: string | null };

const NUEVO = "__nuevo__";

export function ObraForm({ clienteId, obra, directores }: { clienteId: string; obra?: Obra; directores: Director[] }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarObra, undefined);
  const [director, setDirector] = useState(obra?.directorId ?? "");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      {obra && <input type="hidden" name="id" value={obra.id} />}
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Campo
          label="Dirección"
          name="direccion"
          defaultValue={obra?.direccion}
          required
          autoFocus={!obra}
          placeholder="Av. Córdoba 1234, CABA"
          ayuda="Tal como se imprime en los documentos."
          className="sm:col-span-2"
        />
        <Campo label="Nombre corto (opcional)" name="nombre" defaultValue={obra?.nombre ?? ""} placeholder="Obra Córdoba" />
        <Campo label="Localidad / barrio (opcional)" name="localidad" defaultValue={obra?.localidad ?? ""} />
        <Campo label="Provincia (opcional)" name="provincia" defaultValue={obra?.provincia ?? ""} placeholder="CABA" />

        <div className="space-y-1.5">
          <Label htmlFor="directorId">Director de obra</Label>
          <select
            id="directorId"
            name="directorId"
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm"
          >
            <option value="">Sin director</option>
            {directores.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
                {d.empresa ? ` (${d.empresa})` : ""}
              </option>
            ))}
            <option value={NUEVO}>+ Nuevo director…</option>
          </select>
        </div>
        {director === NUEVO && (
          <Campo label="Nombre del nuevo director" name="nuevoDirector" required autoFocus className="sm:col-span-2" />
        )}

        <Campo
          label="Responsable de Higiene y Seguridad (opcional)"
          name="hysNombre"
          defaultValue={obra?.hysNombre ?? ""}
          ayuda="Aparece en el Reporte Mensual."
          className="sm:col-span-2"
        />
        <AreaTexto label="Notas (opcional)" name="notas" defaultValue={obra?.notas ?? ""} className="sm:col-span-2" />
      </div>
      <MensajeError error={estado?.error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : obra ? "Guardar cambios" : "Crear obra"}
      </Button>
    </form>
  );
}
