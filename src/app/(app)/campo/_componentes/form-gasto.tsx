"use client";

import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { guardar } from "@/lib/cola";
import type { DatosGasto } from "@/services/gastos";
import { accionRegistrarGasto } from "../actions";

const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

/**
 * Gasto (spec/08 RF-GAS-01/02). Con `codigo` (Campo) va a la cola offline; sin él se guarda directo.
 * `presupuestoId` null = gasto general de la empresa.
 */
export function FormGasto({ presupuestoId, categorias, codigo, sinTitulo }: { presupuestoId: string | null; categorias: { id: string; nombre: string }[]; codigo?: string; sinTitulo?: boolean }) {
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [r, setR] = useState<{ error?: string; ok?: string }>();
  const [vuelta, setVuelta] = useState(0);
  const [pending, start] = useTransition();
  return (
    <form
      key={vuelta}
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => String(fd.get(k) ?? "").trim();
        const d: DatosGasto = {
          fecha: v("fecha"),
          presupuestoId,
          categoriaId: v("categoriaId"),
          descripcion: v("descripcion"),
          importe: Number(v("importe")),
          moneda,
          tipoCambio: moneda === "USD" ? Number(v("tipoCambio")) : null,
        };
        start(async () => {
          if (codigo) {
            await guardar({ clientId: crypto.randomUUID(), tipo: "gasto", presupuestoId: presupuestoId!, etiqueta: `${codigo} · Gasto: ${d.descripcion}`, gasto: d, fotos: [], fotosSubidas: 0, creada: Date.now() });
            window.dispatchEvent(new Event("pas-cola-nuevo"));
            setR({ ok: `Gasto guardado${navigator.onLine ? "." : ": se envía cuando vuelva la conexión."}` });
          } else {
            setR(await accionRegistrarGasto(d));
          }
          setVuelta((x) => x + 1);
        });
      }}
    >
      {!sinTitulo && <h3 className="text-sm font-semibold">{presupuestoId ? "Cargar gasto" : "Cargar gasto general"}</h3>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gasto-categoria">Categoría</Label>
          <select id="gasto-categoria" name="categoriaId" required defaultValue="" className={select}>
            <option value="" disabled>
              Elegí…
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <Campo id="gasto-descripcion" label="Descripción" name="descripcion" required maxLength={300} placeholder="Nafta camioneta, peaje Panamericana…" />
        <Campo id="gasto-importe" label="Importe" name="importe" type="number" inputMode="decimal" min={0.01} step="0.01" required />
        <div className="space-y-1.5">
          <Label htmlFor="monedaGasto">Moneda</Label>
          <select id="monedaGasto" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={select}>
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        {moneda === "USD" && <Campo id="gasto-tc" label="Tipo de cambio (pesos por dólar)" name="tipoCambio" type="number" min={0.0001} step="0.0001" required />}
        <Campo id="gasto-fecha" label="Fecha" name="fecha" type="date" required defaultValue={hoyAR()} max={hoyAR()} />
      </div>
      <MensajeError error={r?.error} />
      {r?.ok && (
        <p role="status" className="text-sm text-success">
          {r.ok}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Guardar gasto
      </Button>
    </form>
  );
}

/** Consumo de un material que está en la obra (RF-STK-04), por la cola offline. */
export function ConsumoRapido({ presupuestoId, codigo, materiales }: { presupuestoId: string; codigo: string; materiales: { articuloId: string; nombre: string; unidad: string; saldo: number }[] }) {
  const [r, setR] = useState<string>();
  const [vuelta, setVuelta] = useState(0);
  if (!materiales.length) return null;
  return (
    <form
      key={vuelta}
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const articuloId = String(fd.get("articuloId"));
        const cantidad = Number(fd.get("cantidad"));
        const m = materiales.find((x) => x.articuloId === articuloId)!;
        await guardar({ clientId: crypto.randomUUID(), tipo: "consumo", presupuestoId, etiqueta: `${codigo} · Consumo: ${m.nombre} × ${cantidad}`, consumo: { articuloId, cantidad }, fotos: [], fotosSubidas: 0, creada: Date.now() });
        window.dispatchEvent(new Event("pas-cola-nuevo"));
        setR(`Consumo guardado (${m.nombre} × ${cantidad}).`);
        setVuelta((x) => x + 1);
      }}
    >
      <h3 className="text-sm font-semibold">Consumo de material</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="articuloConsumo">Material en obra</Label>
          <select id="articuloConsumo" name="articuloId" required className={select}>
            {materiales.map((m) => (
              <option key={m.articuloId} value={m.articuloId}>
                {m.nombre} (hay {m.saldo} {m.unidad})
              </option>
            ))}
          </select>
        </div>
        <Campo id="consumo-cantidad" label="Cantidad consumida" name="cantidad" type="number" inputMode="decimal" min={0.001} step="0.001" required />
      </div>
      {r && (
        <p role="status" className="text-sm text-success">
          {r}
        </p>
      )}
      <Button type="submit" variant="outline">
        Guardar consumo
      </Button>
    </form>
  );
}
