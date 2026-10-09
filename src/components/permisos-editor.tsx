"use client";

import { useState } from "react";
import { MODULOS, type Accion, type Alcance, type Modulo, type Permiso } from "@/domain/permisos";

const LABEL_ACCION: Record<Accion, string> = {
  leer: "Leer",
  escribir: "Escribir",
  eliminar: "Eliminar",
  cambiar_estado: "Cambiar estado",
  emitir: "Emitir",
  ver_montos: "Ver montos",
};

// Mismas implicaciones que domain/permisos.ts, para que la UI muestre lo que efectivamente se otorga.
const IMPLICA: Partial<Record<Accion, Accion[]>> = {
  escribir: ["leer"],
  eliminar: ["escribir", "leer"],
  cambiar_estado: ["leer"],
  emitir: ["leer"],
  ver_montos: ["leer"],
};

type Estado = Record<string, { acciones: Set<Accion>; alcance: Alcance }>;

function desde(permisos: Permiso[]): Estado {
  const e: Estado = {};
  for (const m of Object.keys(MODULOS)) e[m] = { acciones: new Set(), alcance: "todos" };
  for (const p of permisos) {
    if (!e[p.modulo]) continue;
    // Mostrar también lo implícito (escribir ⇒ leer), que es lo que efectivamente otorga.
    for (const a of [p.accion, ...(IMPLICA[p.accion] ?? [])]) {
      if ((MODULOS[p.modulo].acciones as readonly Accion[]).includes(a)) e[p.modulo].acciones.add(a);
    }
    if (p.alcance === "asignados") e[p.modulo].alcance = "asignados";
  }
  return e;
}

function aPermisos(e: Estado): Permiso[] {
  return Object.entries(e).flatMap(([modulo, { acciones, alcance }]) =>
    [...acciones].map((accion) => ({ modulo: modulo as Modulo, accion, alcance })),
  );
}

/** Matriz módulo × acción + alcance. Serializa en un input hidden `name` (JSON). */
export function PermisosEditor({ name, inicial, disabled }: { name: string; inicial: Permiso[]; disabled?: boolean }) {
  const [estado, setEstado] = useState(() => desde(inicial));

  function toggle(modulo: string, accion: Accion, on: boolean) {
    setEstado((prev) => {
      const acciones = new Set(prev[modulo].acciones);
      if (on) {
        acciones.add(accion);
        for (const i of IMPLICA[accion] ?? []) acciones.add(i);
      } else {
        acciones.delete(accion);
        // Quitar algo implícito quita lo que dependía de eso (ej. sin leer no hay escribir).
        for (const [a, imp] of Object.entries(IMPLICA)) if (imp.includes(accion)) acciones.delete(a as Accion);
      }
      return { ...prev, [modulo]: { ...prev[modulo], acciones } };
    });
  }

  return (
    <fieldset disabled={disabled} className="divide-y rounded-xl border bg-card">
      <legend className="sr-only">Permisos</legend>
      <input type="hidden" name={name} value={JSON.stringify(aPermisos(estado))} />
      {(Object.entries(MODULOS) as [Modulo, (typeof MODULOS)[Modulo]][]).map(([modulo, def]) => {
        const e = estado[modulo];
        return (
          <div key={modulo} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm font-semibold sm:w-48 sm:shrink-0">{def.label}</p>
            <div className="flex flex-1 flex-wrap gap-x-4 gap-y-2">
              {def.acciones.map((accion) => (
                <label key={accion} className="flex min-h-8 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={e.acciones.has(accion)}
                    onChange={(ev) => toggle(modulo, accion, ev.target.checked)}
                  />
                  {LABEL_ACCION[accion]}
                </label>
              ))}
            </div>
            {def.asignable && (
              <select
                aria-label={`Alcance de ${def.label}`}
                className="h-9 rounded-lg border bg-card px-2 text-sm disabled:opacity-50"
                value={e.alcance}
                disabled={e.acciones.size === 0}
                onChange={(ev) =>
                  setEstado((prev) => ({ ...prev, [modulo]: { ...prev[modulo], alcance: ev.target.value as Alcance } }))
                }
              >
                <option value="todos">Todos</option>
                <option value="asignados">Solo asignados</option>
              </select>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
