"use client";

import { useState, useTransition } from "react";
import { PermisosEditor } from "@/components/permisos-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todosLosPermisos, type Permiso } from "@/domain/permisos";
import { useAccion } from "@/hooks/use-accion";
import { accionEliminarRol, accionGuardarRol } from "../actions";

type Rol = {
  id: string;
  nombre: string;
  descripcion: string | null;
  requiere2fa: boolean;
  esSistema: boolean;
  usuarios?: number;
  permisos: Permiso[];
};

export function RolForm({ rol, puedeEscribir, puedeEliminar }: { rol?: Rol; puedeEscribir: boolean; puedeEliminar?: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarRol, undefined);
  const [errorEliminar, setErrorEliminar] = useState<string>();
  const [eliminando, start] = useTransition();
  const editable = puedeEscribir && !rol?.esSistema;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {rol && <input type="hidden" name="id" value={rol.id} />}
      {rol?.esSistema && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">Rol de sistema: tiene todos los permisos y no se puede modificar.</p>
      )}
      <fieldset disabled={!editable} className="grid gap-4 rounded-xl border bg-card p-4">
        <legend className="sr-only">Datos del rol</legend>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" name="nombre" defaultValue={rol?.nombre} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción (opcional)</Label>
          <Input id="descripcion" name="descripcion" defaultValue={rol?.descripcion ?? ""} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiere2fa" defaultChecked={rol?.requiere2fa} className="size-4 accent-primary" />
          Exigir verificación en dos pasos (2FA) a los usuarios con este rol
        </label>
      </fieldset>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Permisos</h2>
        <p className="text-sm text-muted-foreground">
          Eliminar incluye escribir, y escribir incluye leer. &quot;Solo asignados&quot; limita a los presupuestos donde la persona
          está asignada.
        </p>
        <PermisosEditor name="permisos" inicial={rol?.esSistema ? todosLosPermisos() : (rol?.permisos ?? [])} disabled={!editable} />
      </section>

      {estado?.error && (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      )}
      {errorEliminar && (
        <p role="alert" className="text-sm text-destructive">
          {errorEliminar}
        </p>
      )}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : rol ? "Guardar cambios" : "Crear rol"}
          </Button>
          {rol && puedeEliminar && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={eliminando}
              onClick={() => {
                if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return;
                start(async () => setErrorEliminar((await accionEliminarRol(rol.id))?.error));
              }}
            >
              Eliminar rol
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
