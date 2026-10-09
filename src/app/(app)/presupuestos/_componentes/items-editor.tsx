"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { descripcionAuto, ELEMENTOS, TIPOS_SERVICIO, UNIDADES, type TipoServicio, type Unidad } from "@/domain/items";
import { calcularTotales, formatearMonto, type Bonificacion, type Moneda } from "@/domain/montos";

type Fila = {
  tipoServicio: TipoServicio;
  elemento: string | null;
  diametroMm: number | null;
  espesorCm: number | null;
  unidad: Unidad;
  cantidad: number;
  precioUnitario: number;
  descripcion: string | null;
};

const vacia = (): Fila => ({
  tipoServicio: "perforacion",
  elemento: "Viga",
  diametroMm: null,
  espesorCm: null,
  unidad: "u",
  cantidad: 1,
  precioUnitario: 0,
  descripcion: null,
});

const control = "h-10 w-full rounded-lg border border-input bg-card px-2 text-base md:text-sm";
const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function ItemsEditor({
  guardar,
  inicial,
  moneda,
  bonificacion,
  incluyeIva,
  ivaPct,
}: {
  /** Server action ya ligada al presupuesto o adicional. */
  guardar: (json: string) => Promise<{ error?: string; ok?: string } | undefined>;
  inicial: Fila[];
  moneda: Moneda;
  bonificacion: Bonificacion;
  incluyeIva: boolean;
  ivaPct: number;
}) {
  const [filas, setFilas] = useState<Fila[]>(inicial.length ? inicial : [vacia()]);
  const [estado, setEstado] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const totales = calcularTotales(filas, { bonificacion, incluyeIva, ivaPct });
  const set = (i: number, cambios: Partial<Fila>) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {filas.map((f, i) => {
          const auto = descripcionAuto(f);
          return (
            <li key={i} className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Ítem {i + 1}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ítem ${i + 1}`} onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                <label className="col-span-2 space-y-1 text-xs">
                  Servicio
                  <select className={control} value={f.tipoServicio} onChange={(e) => set(i, { tipoServicio: e.target.value as TipoServicio })}>
                    {Object.entries(TIPOS_SERVICIO).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  Elemento
                  <select className={control} value={f.elemento ?? ""} onChange={(e) => set(i, { elemento: e.target.value || null })}>
                    <option value="">—</option>
                    {ELEMENTOS.map((el) => (
                      <option key={el}>{el}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  Ø (mm)
                  <input className={control} inputMode="decimal" value={f.diametroMm ?? ""} onChange={(e) => set(i, { diametroMm: n(e.target.value) })} />
                </label>
                <label className="space-y-1 text-xs">
                  Espesor (cm)
                  <input className={control} inputMode="decimal" value={f.espesorCm ?? ""} onChange={(e) => set(i, { espesorCm: n(e.target.value) })} />
                </label>
                <label className="space-y-1 text-xs">
                  Unidad
                  <select className={control} value={f.unidad} onChange={(e) => set(i, { unidad: e.target.value as Unidad })}>
                    {Object.entries(UNIDADES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  Cantidad
                  <input className={control} inputMode="decimal" value={f.cantidad} onChange={(e) => set(i, { cantidad: n(e.target.value) ?? 0 })} />
                </label>
                <label className="space-y-1 text-xs">
                  Valor unidad
                  <input className={control} inputMode="decimal" value={f.precioUnitario} onChange={(e) => set(i, { precioUnitario: n(e.target.value) ?? 0 })} />
                </label>
              </div>
              <label className="block space-y-1 text-xs">
                Descripción (se arma sola; editala solo si hace falta)
                <input className={control} value={f.descripcion ?? auto} onChange={(e) => set(i, { descripcion: e.target.value === auto ? null : e.target.value })} />
              </label>
              <p className="text-right text-sm tabular-nums">
                {bonificacion?.tipo === "pct" && (
                  <span className="mr-2 text-muted-foreground">Bonificado: {formatearMonto(totales.lineas[i]?.precioUnitario ?? 0, moneda)} c/u ·</span>
                )}
                Subtotal <strong>{formatearMonto(totales.lineas[i]?.subtotal ?? 0, moneda)}</strong>
              </p>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" onClick={() => setFilas((fs) => [...fs, fs.length ? { ...fs[fs.length - 1], cantidad: 1, descripcion: null } : vacia()])}>
        <Plus data-icon="inline-start" /> Agregar ítem
      </Button>

      <dl className="ml-auto max-w-sm space-y-1 rounded-xl border bg-card p-4 text-sm tabular-nums">
        {totales.bonificacionMonto > 0 && (
          <>
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatearMonto(totales.subtotal, moneda)}</dd>
            </div>
            <div className="flex justify-between text-primary-text">
              <dt>Bonificación</dt>
              <dd>− {formatearMonto(totales.bonificacionMonto, moneda)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Total neto</dt>
          <dd>{formatearMonto(totales.neto, moneda)}</dd>
        </div>
        {incluyeIva && (
          <>
            <div className="flex justify-between">
              <dt>IVA {ivaPct}%</dt>
              <dd>{formatearMonto(totales.iva, moneda)}</dd>
            </div>
            <div className="flex justify-between font-heading text-base font-bold">
              <dt>Total</dt>
              <dd>{formatearMonto(totales.total, moneda)}</dd>
            </div>
          </>
        )}
      </dl>

      <MensajeError error={estado?.error} />
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
      <Button type="button" size="lg" disabled={pending} onClick={() => start(async () => setEstado(await guardar(JSON.stringify(filas))))}>
        {pending ? "Guardando…" : "Guardar ítems"}
      </Button>
    </div>
  );
}
