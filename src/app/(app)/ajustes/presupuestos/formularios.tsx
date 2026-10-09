"use client";

import { useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { codigoPresupuesto } from "@/domain/codigos";
import { useAccion } from "@/hooks/use-accion";
import type { DefaultsPresupuesto } from "@/services/configuracion";
import { accionFijarNumero, accionGuardarDefaults, accionGuardarFirma, accionQuitarFirma } from "../actions";

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

/** Firma de la empresa en los documentos (spec/06 §6). Sin firma, va el logo de la plantilla. */
export function FormFirma({ url, editable }: { url: string | null; editable: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarFirma, undefined);
  const [quitando, start] = useTransition();
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, sin optimizar
        <img src={url} alt="Firma actual" className="max-h-24 w-auto rounded-lg border bg-white p-2" />
      ) : (
        <p className="text-sm text-muted-foreground">Sin firma cargada: los documentos llevan el logo de PAS.</p>
      )}
      {editable && (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="firma" className="text-sm font-semibold">
              {url ? "Reemplazar firma" : "Cargar firma"}
            </label>
            <input id="firma" name="firma" type="file" accept="image/png" required className="block text-sm file:mr-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-2" />
            <p className="text-xs text-muted-foreground">PNG con fondo transparente, hasta 1 MB.</p>
          </div>
          <Button type="submit" disabled={pending}>
            Guardar firma
          </Button>
          {url && (
            <Button
              type="button"
              variant="outline"
              disabled={quitando}
              onClick={() => confirm("¿Quitar la firma? Los documentos nuevos van a llevar el logo.") && start(async () => void (await accionQuitarFirma()))}
            >
              Quitar
            </Button>
          )}
        </form>
      )}
      <MensajeError error={estado?.error} />
      <Ok ok={estado?.ok} />
    </div>
  );
}
