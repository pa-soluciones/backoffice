"use client";

import { useState } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Bonificacion, Moneda } from "@/domain/montos";
import { useAccion } from "@/hooks/use-accion";
import { accionGuardarComerciales } from "../actions";

type Datos = {
  id: string;
  moneda: Moneda;
  tipoCambioRef: number | null;
  incluyeIva: boolean;
  ivaPct: number;
  validezDias: number;
  formaContratacion: string;
  baseAjuste: string;
  anticipoPct: number;
  bonificacion: Bonificacion;
};

const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";

/** Moneda, IVA, validez, anticipo y bonificación (spec/05 §1). */
export function ComercialesForm({ p }: { p: Datos }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarComerciales, undefined);
  const [bonifTipo, setBonifTipo] = useState(p.bonificacion?.tipo ?? "");
  const [iva, setIva] = useState(p.incluyeIva);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={p.id} />
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="moneda">Moneda</Label>
          <select id="moneda" name="moneda" defaultValue={p.moneda} className={select}>
            <option value="ARS">Pesos argentinos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <Campo label="Tipo de cambio de referencia (opcional)" name="tipoCambioRef" inputMode="decimal" defaultValue={p.tipoCambioRef ?? ""} ayuda="Informativo, no se imprime." />
        <Campo label="Validez de la oferta (días)" name="validezDias" type="number" min={1} defaultValue={p.validezDias} required />
        <Campo label="Forma de contratación" name="formaContratacion" defaultValue={p.formaContratacion} required />
        <Campo label="Base de ajuste" name="baseAjuste" defaultValue={p.baseAjuste} required />
        <Campo label="Anticipo (%)" name="anticipoPct" type="number" min={0} max={100} step="0.01" defaultValue={p.anticipoPct} required />

        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="incluyeIva" checked={iva} onChange={(e) => setIva(e.target.checked)} className="size-4 accent-primary" />
            Discriminar IVA (por defecto se cotiza sin IVA)
          </label>
          {iva ? (
            <Campo label="IVA (%)" name="ivaPct" type="number" min={0} max={100} step="0.01" defaultValue={p.ivaPct} className="sm:w-48" />
          ) : (
            <input type="hidden" name="ivaPct" value={p.ivaPct} />
          )}
        </div>

        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
          <div className="space-y-1.5">
            <Label htmlFor="bonifTipo">Bonificación</Label>
            <select id="bonifTipo" name="bonifTipo" value={bonifTipo} onChange={(e) => setBonifTipo(e.target.value as typeof bonifTipo)} className={select}>
              <option value="">Sin bonificación</option>
              <option value="pct">Porcentaje sobre el valor unitario</option>
              <option value="monto">Monto fijo sobre el total</option>
            </select>
          </div>
          {bonifTipo && (
            <Campo
              label={bonifTipo === "pct" ? "Porcentaje (%)" : `Monto (${p.moneda})`}
              name="bonifValor"
              inputMode="decimal"
              defaultValue={p.bonificacion?.valor ?? ""}
              required
            />
          )}
        </div>
      </div>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar condiciones"}
      </Button>
    </form>
  );
}
