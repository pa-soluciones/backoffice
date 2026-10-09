import { etiquetaDiferencia, type FilaBalance } from "@/domain/balance";
import { formatearMonto } from "@/domain/montos";

const TONO = { exceso: "text-primary-text", pendiente: "text-muted-foreground", completo: "text-success" } as const;

/** Balance por diámetro (spec/07 RF-BAL-01/02). */
export function TablaBalance({
  filas,
  totales,
  verMontos,
  moneda,
}: {
  filas: FilaBalance[];
  totales: { cotizadas: number; ejecutadas: number; diferencia: number };
  verMontos: boolean;
  moneda: "ARS" | "USD";
}) {
  if (filas.length === 0) return <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin perforaciones cotizadas ni registradas.</p>;
  return (
    <>
    {/* Mobile: una tarjeta por diámetro. */}
    <ul className="divide-y rounded-xl border bg-card text-sm sm:hidden">
      {filas.map((f) => {
        const e = etiquetaDiferencia(f.diferencia);
        const avance = f.cotizadas ? Math.min(100, Math.round((f.ejecutadas / f.cotizadas) * 100)) : 100;
        return (
          <li key={f.diametroMm} className="space-y-1.5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Ø {f.diametroMm} mm</span>
              <span className="tabular-nums">
                <strong>{f.ejecutadas}</strong> de {f.cotizadas}
              </span>
            </div>
            <span className="block h-1.5 rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${avance}%` }} />
            </span>
            <p className={`text-xs font-semibold ${TONO[e.tono]}`}>
              {e.texto}
              {verMontos && f.precioUnitario != null && f.diferencia ? ` · ${formatearMonto(f.diferencia * f.precioUnitario, moneda)}` : ""}
            </p>
          </li>
        );
      })}
      <li className="flex justify-between p-3 font-semibold">
        <span>Totales</span>
        <span className="tabular-nums">
          {totales.ejecutadas} de {totales.cotizadas} ({totales.diferencia > 0 ? "+" : ""}
          {totales.diferencia})
        </span>
      </li>
    </ul>
    <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-3 font-semibold">Ø</th>
            <th className="p-3 text-right font-semibold">Cotizadas</th>
            <th className="p-3 text-right font-semibold">Ejecutadas</th>
            <th className="p-3 font-semibold">Diferencia</th>
            {verMontos && <th className="p-3 text-right font-semibold">Valorizado</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => {
            const e = etiquetaDiferencia(f.diferencia);
            const avance = f.cotizadas ? Math.min(100, Math.round((f.ejecutadas / f.cotizadas) * 100)) : 100;
            return (
              <tr key={f.diametroMm}>
                <td className="p-3 font-semibold whitespace-nowrap">{f.diametroMm} mm</td>
                <td className="p-3 text-right tabular-nums">{f.cotizadas}</td>
                <td className="p-3 text-right tabular-nums">
                  {f.ejecutadas}
                  <span className="mt-1 block h-1.5 rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${avance}%` }} />
                  </span>
                </td>
                <td className={`p-3 font-semibold ${TONO[e.tono]}`}>{e.texto}</td>
                {verMontos && (
                  <td className="p-3 text-right tabular-nums whitespace-nowrap">{f.precioUnitario != null && f.diferencia ? formatearMonto(f.diferencia * f.precioUnitario, moneda) : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t font-semibold">
          <tr>
            <td className="p-3">Totales</td>
            <td className="p-3 text-right tabular-nums">{totales.cotizadas}</td>
            <td className="p-3 text-right tabular-nums">{totales.ejecutadas}</td>
            <td className="p-3" colSpan={verMontos ? 2 : 1}>
              {totales.diferencia > 0 ? "+" : ""}
              {totales.diferencia} unidades en total
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
}
