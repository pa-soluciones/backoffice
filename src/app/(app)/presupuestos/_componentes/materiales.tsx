"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMonto } from "@/domain/montos";
import { TIPOS_MOVIMIENTO, type TipoMovimiento } from "@/domain/stock";
import { accionAsignar, accionCierreMateriales, accionConsumo, type Estado } from "../../stock/actions";

type EnObra = { articuloId: string; nombre: string; unidad: string; saldo: number };
type Disponible = { id: string; nombre: string; unidad: string; disponible: number };
type Mov = { id: string; tipo: TipoMovimiento; articulo: string; unidad: string; cantidad: number; fecha: string; motivo: string | null; autor: string | null; costo: number | null };

const cant = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";

function Resultado({ estado }: { estado: Estado }) {
  return (
    <>
      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
    </>
  );
}

/** Materiales del presupuesto (spec/08 RF-STK-04/05): en obra, asignar, consumo y cierre. */
export function Materiales({
  presupuestoId,
  enObra,
  disponibles,
  movimientos,
  editable,
}: {
  presupuestoId: string;
  enObra: EnObra[];
  disponibles: Disponible[];
  movimientos: Mov[];
  /** Presupuesto En progreso y permiso de stock. */
  editable: boolean;
}) {
  const [modo, setModo] = useState<"asignar" | "cierre" | null>(null);
  return (
    <div className="space-y-4">
      {enObra.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No hay materiales en la obra.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm" aria-label="Materiales en obra">
          {enObra.map((m) => (
            <FilaEnObra key={m.articuloId} presupuestoId={presupuestoId} m={m} editable={editable} />
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={modo === "asignar" ? "secondary" : "outline"} onClick={() => setModo(modo === "asignar" ? null : "asignar")}>
            Asignar del depósito
          </Button>
          {enObra.length > 0 && (
            <Button type="button" variant={modo === "cierre" ? "secondary" : "outline"} onClick={() => setModo(modo === "cierre" ? null : "cierre")}>
              Cierre de materiales
            </Button>
          )}
        </div>
      )}
      {modo === "asignar" && <Asignar presupuestoId={presupuestoId} disponibles={disponibles} onListo={() => setModo(null)} />}
      {modo === "cierre" && <Cierre presupuestoId={presupuestoId} enObra={enObra} onListo={() => setModo(null)} />}

      {movimientos.length > 0 && (
        <details className="rounded-xl border bg-card text-sm">
          <summary className="cursor-pointer p-3 font-semibold">Movimientos ({movimientos.length})</summary>
          <ul className="divide-y border-t">
            {movimientos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  {TIPOS_MOVIMIENTO[m.tipo]} · {m.articulo} · {cant.format(m.cantidad)} {m.unidad}
                  <span className="block text-xs text-muted-foreground">{[dia(m.fecha), m.motivo, m.autor].filter(Boolean).join(" · ")}</span>
                </span>
                {m.costo != null && m.tipo === "consumo" && <span className="text-xs tabular-nums">{formatearMonto(m.costo)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FilaEnObra({ presupuestoId, m, editable }: { presupuestoId: string; m: EnObra; editable: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-0 flex-1 font-semibold">{m.nombre}</span>
      <span className="tabular-nums">
        {cant.format(m.saldo)} {m.unidad}
      </span>
      {editable && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
          Consumo
        </Button>
      )}
      {abierto && (
        <form
          className="flex w-full flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const cantidad = Number(new FormData(e.currentTarget).get("cantidad"));
            start(async () => {
              const r = await accionConsumo(presupuestoId, m.articuloId, cantidad);
              setEstado(r);
              if (r?.ok) setAbierto(false);
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`consumo-${m.articuloId}`}>Cantidad consumida ({m.unidad})</Label>
            <Input id={`consumo-${m.articuloId}`} name="cantidad" type="number" min={0.001} max={m.saldo} step="0.001" required className="h-11 w-36" />
          </div>
          <Button type="submit" disabled={pending}>
            Registrar consumo
          </Button>
        </form>
      )}
      <div className="w-full empty:hidden">
        <Resultado estado={estado} />
      </div>
    </li>
  );
}

function Asignar({ presupuestoId, disponibles, onListo }: { presupuestoId: string; disponibles: Disponible[]; onListo: () => void }) {
  const [lineas, setLineas] = useState([{ key: 0, articuloId: "", cantidad: "" }]);
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  if (!disponibles.length) return <p className="text-sm text-muted-foreground">El depósito no tiene stock para asignar. Registrá una compra en Stock.</p>;
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await accionAsignar(presupuestoId, JSON.stringify(lineas.map((l) => ({ articuloId: l.articuloId, cantidad: Number(l.cantidad) }))));
          setEstado(r);
          if (r?.ok) onListo();
        });
      }}
    >
      <h3 className="text-sm font-semibold">Asignar materiales del depósito</h3>
      {lineas.map((l, i) => {
        const d = disponibles.find((x) => x.id === l.articuloId);
        return (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`asig-${l.key}`}>Artículo {i + 1}</Label>
              <select id={`asig-${l.key}`} required value={l.articuloId} onChange={(e) => setLineas((ls) => ls.map((x) => (x.key === l.key ? { ...x, articuloId: e.target.value } : x)))} className={select}>
                <option value="" disabled>
                  Elegí…
                </option>
                {disponibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} (hay {cant.format(a.disponible)} {a.unidad})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`asig-cant-${l.key}`}>Cantidad</Label>
              <Input
                id={`asig-cant-${l.key}`}
                type="number"
                min={0.001}
                max={d?.disponible}
                step="0.001"
                required
                value={l.cantidad}
                onChange={(e) => setLineas((ls) => ls.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value } : x)))}
                className="h-11"
              />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar artículo ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2 />
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setLineas((ls) => [...ls, { key: Date.now(), articuloId: "", cantidad: "" }])}>
          <Plus data-icon="inline-start" /> Otro artículo
        </Button>
        <Button type="submit" disabled={pending}>
          Asignar
        </Button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}

function Cierre({ presupuestoId, enObra, onListo }: { presupuestoId: string; enObra: EnObra[]; onListo: () => void }) {
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const lineas = enObra.map((m) => ({
          articuloId: m.articuloId,
          consumido: Number(fd.get(`consumido_${m.articuloId}`)),
          devuelto: Number(fd.get(`devuelto_${m.articuloId}`)),
          nota: String(fd.get(`nota_${m.articuloId}`) ?? "").trim() || null,
        }));
        start(async () => {
          const r = await accionCierreMateriales(presupuestoId, JSON.stringify(lineas));
          setEstado(r);
          if (r?.ok) onListo();
        });
      }}
    >
      <h3 className="text-sm font-semibold">Cierre de materiales</h3>
      <p className="text-xs text-muted-foreground">Por cada material, cuánto se consumió y cuánto vuelve al depósito (tiene que sumar lo que hay en obra). Es obligatorio para pasar a Pendiente liquidación.</p>
      {enObra.map((m) => (
        <fieldset key={m.articuloId} className="grid gap-2 border-t pt-3 sm:grid-cols-3">
          <legend className="text-sm font-semibold">
            {m.nombre} · en obra {cant.format(m.saldo)} {m.unidad}
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor={`consumido_${m.articuloId}`}>Consumido</Label>
            <Input id={`consumido_${m.articuloId}`} name={`consumido_${m.articuloId}`} type="number" min={0} max={m.saldo} step="0.001" required defaultValue={m.saldo} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`devuelto_${m.articuloId}`}>Vuelve al depósito</Label>
            <Input id={`devuelto_${m.articuloId}`} name={`devuelto_${m.articuloId}`} type="number" min={0} max={m.saldo} step="0.001" required defaultValue={0} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`nota_${m.articuloId}`}>Estado al volver</Label>
            <Input id={`nota_${m.articuloId}`} name={`nota_${m.articuloId}`} maxLength={200} placeholder="Vida restante aprox. 40%" className="h-11" />
          </div>
        </fieldset>
      ))}
      <Button type="submit" disabled={pending}>
        Confirmar cierre
      </Button>
      <Resultado estado={estado} />
    </form>
  );
}
