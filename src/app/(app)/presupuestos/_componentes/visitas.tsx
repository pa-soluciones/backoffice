"use client";

import { useState } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionAgendarVisita, accionResolverVisita } from "../actions";

export function AgendarVisita({ presupuestoId, direccion, usuarios }: { presupuestoId: string; direccion: string | null; usuarios: { id: string; name: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, onSubmit, pending] = useAccion(accionAgendarVisita.bind(null, presupuestoId), undefined);
  if (!abierto)
    return (
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        Agendar visita técnica
      </Button>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Fecha y hora" name="inicio" type="datetime-local" ayuda="Dejalo vacío si todavía no está coordinada." />
        <Campo label="Duración estimada (min)" name="duracionMin" type="number" min={15} step={15} defaultValue={60} required />
        <Campo label="Dirección" name="direccion" defaultValue={direccion ?? ""} className="sm:col-span-2" />
        <Campo label="Contacto en sitio" name="contactoSitio" className="sm:col-span-2" />
        <AreaTexto label="Notas previas" name="notasPrevias" rows={2} className="sm:col-span-2" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Responsables</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {usuarios.map((u) => (
            <label key={u.id} className="flex min-h-8 items-center gap-2 text-sm">
              <input type="checkbox" name="responsables" value={u.id} className="size-4 accent-primary" />
              {u.name}
            </label>
          ))}
        </div>
      </fieldset>
      <MensajeError error={estado?.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Agendar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ResolverVisita({ presupuestoId, visitaId }: { presupuestoId: string; visitaId: string }) {
  const [resultado, setResultado] = useState<"" | "realizada" | "omitida" | "cancelada">("");
  const [estado, onSubmit, pending] = useAccion(accionResolverVisita.bind(null, presupuestoId, visitaId), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(["realizada", "omitida", "cancelada"] as const).map((r) => (
          <Button key={r} type="button" size="sm" variant={resultado === r ? "secondary" : "outline"} onClick={() => setResultado(r)}>
            {r === "realizada" ? "Marcar realizada" : r === "omitida" ? "Omitir" : "Cancelar visita"}
          </Button>
        ))}
      </div>
      {resultado && (
        <>
          <input type="hidden" name="estado" value={resultado} />
          <AreaTexto
            label={resultado === "realizada" ? "Notas de la visita (medidas, observaciones)" : "Motivo"}
            name="notas"
            rows={3}
            required={resultado === "omitida"}
          />
          <MensajeError error={estado?.error} />
          <Button type="submit" size="sm" disabled={pending}>
            Confirmar
          </Button>
        </>
      )}
    </form>
  );
}
