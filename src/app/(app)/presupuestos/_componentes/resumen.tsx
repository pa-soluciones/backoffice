import { formatearMonto } from "@/domain/montos";
import type { Resumen } from "@/domain/resumen";

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${fuerte ? "border-t pt-2 font-semibold" : ""}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/** Resumen económico del presupuesto (spec/08 RF-RES-01). */
export function ResumenEconomico({ r }: { r: Resumen & { congelado: boolean } }) {
  const m = (n: number | null) => (n == null ? "—" : formatearMonto(n, r.moneda));
  return (
    <div className="space-y-3">
      <div className="grid gap-4 rounded-xl border bg-card p-4 text-sm md:grid-cols-2">
        <div>
          <h3 className="mb-1 font-semibold">Ingresos</h3>
          <dl>
          <Fila k="Total presupuestado" v={m(r.ingresos.presupuestado)} />
          <Fila k="Adicionales aprobados" v={m(r.ingresos.adicionales)} />
          <Fila k="Total a cobrar" v={m(r.ingresos.totalACobrar)} fuerte />
          <Fila k="Cobrado" v={m(r.ingresos.cobrado)} />
          <Fila k="Pendiente" v={m(r.ingresos.pendiente)} />
          </dl>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Egresos</h3>
          <dl>
          <Fila k="Materiales consumidos" v={m(r.egresos.materiales)} />
          {r.egresos.gastos.map((g) => (
            <Fila key={g.categoria} k={g.categoria} v={m(g.importe)} />
          ))}
          <Fila k="Total egresos" v={m(r.egresos.total)} fuerte />
          </dl>
        </div>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border bg-card p-4">
        <span className="text-sm text-muted-foreground">{r.congelado ? "Resultado final" : "Resultado proyectado"}</span>
        <strong className={`text-xl tabular-nums ${r.resultado != null && r.resultado < 0 ? "text-destructive" : ""}`}>{m(r.resultado)}</strong>
        {r.margen != null && <span className="text-sm">Margen {r.margen.toLocaleString("es-AR")}%</span>}
      </p>
      {r.moneda === "USD" && (
        <p className="text-xs text-muted-foreground">
          {r.tipoCambio
            ? `Egresos en pesos convertidos a ${r.tipoCambio.toLocaleString("es-AR")} pesos por dólar (último tipo de cambio usado en la obra).`
            : `Presupuesto en dólares: los egresos (${formatearMonto(r.egresos.totalArs, "ARS")}) se convierten cuando haya un cobro o gasto con tipo de cambio.`}
        </p>
      )}
    </div>
  );
}
