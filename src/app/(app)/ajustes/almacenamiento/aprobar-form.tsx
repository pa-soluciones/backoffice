"use client";

import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { costoEstimado, FREE_TIER } from "@/domain/cuota-r2";
import { useAccion } from "@/hooks/use-accion";
import { accionAprobarExcedente } from "../actions";

const OPCIONES = [
  { factor: 1, texto: "Hasta el 100% del plan gratuito (sin margen de seguridad)" },
  { factor: 1.5, texto: "Hasta el 150% del plan gratuito" },
  { factor: 2, texto: "Hasta el doble del plan gratuito" },
];

const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function AprobarExcedente() {
  const [estado, onSubmit, pending] = useAccion(accionAprobarExcedente, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <fieldset className="space-y-2">
        <legend className="font-semibold">Ampliar los límites de este mes</legend>
        {OPCIONES.map((o) => {
          const maximo = costoEstimado({
            almacenamiento: FREE_TIER.almacenamiento * o.factor,
            opsA: FREE_TIER.opsA * o.factor,
            opsB: FREE_TIER.opsB * o.factor,
          });
          return (
            <label key={o.factor} className="flex items-start gap-2 text-sm">
              <input type="radio" name="factor" value={o.factor} required className="mt-0.5 size-4 accent-primary" />
              <span>
                {o.texto}
                <span className="block text-muted-foreground">Costo máximo posible: {maximo === 0 ? "USD 0,00" : `hasta ${usd.format(maximo)}`} en el mes.</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <label className="flex items-start gap-2 text-sm font-semibold">
        <input type="checkbox" name="acepto" required className="mt-0.5 size-4 accent-primary" />
        Entiendo que lo que supere el plan gratuito se cobra en la tarjeta de la cuenta de Cloudflare.
      </label>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          Límites ampliados para este mes.
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        Aprobar
      </Button>
    </form>
  );
}
