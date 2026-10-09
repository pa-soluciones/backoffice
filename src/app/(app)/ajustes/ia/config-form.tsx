"use client";

import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MODELOS } from "@/domain/ia";
import { useAccion } from "@/hooks/use-accion";
import type { ConfigIA } from "@/services/ia";
import { accionGuardarConfigIA } from "../actions";

export function ConfigIAForm({ config, editable }: { config: ConfigIA; editable: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarConfigIA, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={!editable} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <legend className="sr-only">Configuración</legend>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="modelo">Modelo</Label>
          <select id="modelo" name="modelo" defaultValue={config.modelo} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm">
            {Object.entries(MODELOS).map(([id, m]) => (
              <option key={id} value={id}>
                {m.nombre} · USD {m.entrada} / {m.salida} por millón de tokens
              </option>
            ))}
          </select>
        </div>
        <Campo
          label="Tope mensual (USD)"
          name="limiteMensualUsd"
          type="number"
          min={0}
          step="0.5"
          defaultValue={config.limiteMensualUsd}
          ayuda="Al llegar al tope, la IA se desactiva hasta el mes siguiente. 0 = desactivada."
        />
      </fieldset>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          Guardado.
        </p>
      )}
      {editable && (
        <Button type="submit" disabled={pending}>
          Guardar
        </Button>
      )}
    </form>
  );
}
