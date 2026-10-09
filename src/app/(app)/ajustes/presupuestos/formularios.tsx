"use client";

import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { codigoPresupuesto } from "@/domain/codigos";
import { useAccion } from "@/hooks/use-accion";
import type { DefaultsPresupuesto } from "@/services/configuracion";
import { accionFijarNumero, accionGuardarDefaults } from "../actions";

function Ok({ ok }: { ok?: boolean }) {
  return ok ? (
    <p role="status" className="text-sm text-success">
      Guardado.
    </p>
  ) : null;
}

export function FilaNumeracion({ anio, proximo, maxUsado, editable }: { anio: number; proximo: number; maxUsado: number; editable: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionFijarNumero.bind(null, anio), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-2 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32">
          <p className="font-heading text-lg font-bold">{anio}</p>
          <p className="text-xs text-muted-foreground">{maxUsado ? `Último usado: ${codigoPresupuesto(anio, maxUsado)}` : "Sin presupuestos todavía"}</p>
        </div>
        <Campo
          label="Próximo número"
          name="proximo"
          type="number"
          min={maxUsado + 1}
          defaultValue={proximo}
          disabled={!editable}
          className="w-40"
          ayuda={`Será ${codigoPresupuesto(anio, proximo)}`}
        />
        {editable && (
          <Button type="submit" variant="outline" disabled={pending}>
            Guardar
          </Button>
        )}
      </div>
      <MensajeError error={estado?.error} />
      <Ok ok={estado?.ok} />
    </form>
  );
}

export function FormDefaults({ d, editable }: { d: DefaultsPresupuesto; editable: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarDefaults, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={!editable} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <legend className="sr-only">Valores por defecto</legend>
        <Campo label="Validez de la oferta (días)" name="validezDias" type="number" min={1} defaultValue={d.validezDias} required />
        <Campo label="Anticipo (%)" name="anticipoPct" type="number" min={0} max={100} step="0.01" defaultValue={d.anticipoPct} required />
        <Campo label="IVA (%) cuando se discrimina" name="ivaPct" type="number" min={0} max={100} step="0.01" defaultValue={d.ivaPct} required />
        <Campo label="Forma de contratación" name="formaContratacion" defaultValue={d.formaContratacion} required />
        <Campo label="Base de ajuste" name="baseAjuste" defaultValue={d.baseAjuste} required />
      </fieldset>
      <MensajeError error={estado?.error} />
      <Ok ok={estado?.ok} />
      {editable && (
        <Button type="submit" size="lg" disabled={pending}>
          Guardar valores por defecto
        </Button>
      )}
    </form>
  );
}
