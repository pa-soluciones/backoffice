"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Plegable } from "@/components/plegable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ESTADOS_COBRO, MEDIOS, type EstadoCobro } from "@/domain/cobros";
import { formatearMonto, type Moneda } from "@/domain/montos";
import { useAccion } from "@/hooks/use-accion";
import { cn } from "@/lib/utils";
import { accionEliminarCobro, accionRegistrarCobro } from "../actions";

type Esperado = { id: string; descripcion: string; importe: number; imputado: number; estado: EstadoCobro };
type Recibido = {
  id: string;
  cobroEsperadoId: string;
  fecha: string;
  importe: number;
  monedaRecibida: Moneda;
  tipoCambio: number | null;
  importeImputado: number;
  medio: string;
  referencia: string | null;
  autor: string | null;
};

const TONO: Record<EstadoCobro, string> = { pendiente: "bg-muted text-muted-foreground", parcial: "bg-warning/15 text-foreground", abonado: "bg-success/15 text-success" };
const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Cobros del presupuesto (spec/08 RF-COB-02..04). */
export function Cobros({
  presupuestoId,
  moneda,
  esperados,
  recibidos,
  totalEsperado,
  cobrado,
  porCobrar,
  puedeRegistrar,
  puedeEliminar,
}: {
  presupuestoId: string;
  moneda: Moneda;
  esperados: Esperado[];
  recibidos: Recibido[];
  totalEsperado: number;
  cobrado: number;
  porCobrar: number;
  puedeRegistrar: boolean;
  puedeEliminar: boolean;
}) {
  const m = (n: number) => formatearMonto(n, moneda);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Esperado</dt>
          <dd className="font-semibold tabular-nums">{m(totalEsperado)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="font-semibold tabular-nums">{m(cobrado)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Por cobrar</dt>
          <dd className="font-semibold tabular-nums">{m(porCobrar)}</dd>
        </div>
      </dl>

      {esperados.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Los cobros esperados se generan al pasar a En progreso (anticipo) y a Pendiente liquidación (saldo).</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {esperados.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1">{e.descripcion}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TONO[e.estado])}>{ESTADOS_COBRO[e.estado]}</span>
              <span className="w-full text-right tabular-nums sm:w-auto">
                {e.estado === "parcial" ? `${m(e.imputado)} de ` : ""}
                {m(e.importe)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {recibidos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Cobros recibidos</h3>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {recibidos.map((r) => (
              <FilaRecibido key={r.id} presupuestoId={presupuestoId} r={r} concepto={esperados.find((e) => e.id === r.cobroEsperadoId)?.descripcion ?? ""} moneda={moneda} puedeEliminar={puedeEliminar} />
            ))}
          </ul>
        </div>
      )}

      {puedeRegistrar && (
        <Plegable titulo="Nuevo cobro" abierto={esperados.some((e) => e.estado !== "abonado")}>
          <FormCobro presupuestoId={presupuestoId} moneda={moneda} esperados={esperados} />
        </Plegable>
      )}
    </div>
  );
}

function FilaRecibido({ presupuestoId, r, concepto, moneda, puedeEliminar }: { presupuestoId: string; r: Recibido; concepto: string; moneda: Moneda; puedeEliminar: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const otraMoneda = r.monedaRecibida !== moneda;
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tabular-nums">
          {formatearMonto(r.importe, r.monedaRecibida)}
          {otraMoneda && ` → ${formatearMonto(r.importeImputado, moneda)} (TC ${r.tipoCambio})`}
        </span>
        <span className="block text-xs text-muted-foreground">{[dia(r.fecha), MEDIOS[r.medio as keyof typeof MEDIOS] ?? r.medio, r.referencia, concepto, r.autor].filter(Boolean).join(" · ")}</span>
      </span>
      {puedeEliminar && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Eliminar cobro del ${dia(r.fecha)}`}
          onClick={() => confirm("¿Eliminar este cobro?") && start(async () => setError((await accionEliminarCobro(presupuestoId, r.id))?.error))}
        >
          <Trash2 />
        </Button>
      )}
      <MensajeError error={error} />
    </li>
  );
}

function FormCobro({ presupuestoId, moneda, esperados }: { presupuestoId: string; moneda: Moneda; esperados: Esperado[] }) {
  const [estado, onSubmit, pending] = useAccion(accionRegistrarCobro.bind(null, presupuestoId), undefined);
  const pendientes = esperados.filter((e) => e.estado !== "abonado");
  const [elegidoId, setConcepto] = useState(pendientes[0]?.id ?? "otro");
  // Si el concepto elegido quedó abonado, se pasa al primero pendiente.
  const concepto = elegidoId === "otro" || pendientes.some((e) => e.id === elegidoId) ? elegidoId : (pendientes[0]?.id ?? "otro");
  const [recibida, setRecibida] = useState<Moneda>(moneda);
  const elegido = esperados.find((e) => e.id === concepto);
  const resto = elegido ? Math.max(0, Math.round((elegido.importe - elegido.imputado) * 100) / 100) : "";
  return (
    // key: tras registrar un cobro cambia lo imputado y el formulario vuelve a sus valores propuestos.
    <form key={esperados.map((e) => e.imputado).join()} onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="concepto">Concepto</Label>
          <select id="concepto" name="concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} className={select}>
            {pendientes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.descripcion}
              </option>
            ))}
            <option value="otro">Otro concepto…</option>
          </select>
        </div>
        {concepto === "otro" && <Campo label="Descripción del concepto" name="descripcionOtro" required maxLength={200} className="sm:col-span-2" />}
        {/* key: al cambiar de concepto se propone lo que falta cobrar de ese concepto. */}
        <Campo key={concepto} label="Importe" name="importe" type="number" inputMode="decimal" min={0.01} step="0.01" required defaultValue={resto} />
        <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoyAR()} max={hoyAR()} />
        <div className="space-y-1.5">
          <Label htmlFor="monedaRecibida">Moneda recibida</Label>
          <select id="monedaRecibida" name="monedaRecibida" value={recibida} onChange={(e) => setRecibida(e.target.value as Moneda)} className={select}>
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        {recibida !== moneda && <Campo label="Tipo de cambio (pesos por dólar)" name="tipoCambio" type="number" inputMode="decimal" min={0.0001} step="0.0001" required />}
        <div className="space-y-1.5">
          <Label htmlFor="medio">Medio de pago</Label>
          <select id="medio" name="medio" defaultValue="transferencia" className={select}>
            {Object.entries(MEDIOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Campo label="Referencia" name="referencia" maxLength={200} placeholder="Nro. de operación, cheque…" />
      </div>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Registrar cobro
      </Button>
    </form>
  );
}
