"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIAS_ARTICULO, UNIDADES_ARTICULO } from "@/domain/stock";
import { useAccion } from "@/hooks/use-accion";
import { accionAjuste, accionCrearArticulo, accionActualizarArticulo, accionRegistrarCompra, type Estado } from "../actions";

const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

function Ok({ estado }: { estado: Estado }) {
  return estado?.ok ? (
    <p role="status" className="text-sm text-success">
      {estado.ok}
    </p>
  ) : null;
}

type Articulo = { id?: string; nombre: string; categoria: string; unidad: string; atributos: Record<string, string>; stockMinimo: number | null; notas: string | null };

export function FormArticulo({ articulo, editable = true }: { articulo?: Articulo; editable?: boolean }) {
  const accion = articulo?.id ? accionActualizarArticulo.bind(null, articulo.id) : accionCrearArticulo;
  const [estado, onSubmit, pending] = useAccion(accion, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={!editable} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <legend className="sr-only">Artículo</legend>
        <Campo label="Nombre" name="nombre" required maxLength={120} defaultValue={articulo?.nombre} className="sm:col-span-2" />
        <div className="space-y-1.5">
          <Label htmlFor="categoria">Categoría</Label>
          <select id="categoria" name="categoria" required defaultValue={articulo?.categoria ?? ""} className={select}>
            <option value="" disabled>
              Elegí…
            </option>
            {CATEGORIAS_ARTICULO.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidad">Unidad</Label>
          <select id="unidad" name="unidad" defaultValue={articulo?.unidad ?? "u"} className={select}>
            {Object.entries(UNIDADES_ARTICULO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Campo label="Ø (mm)" name="diametro" defaultValue={articulo?.atributos.diametro} />
        <Campo label="Marca" name="marca" defaultValue={articulo?.atributos.marca} />
        <Campo label="Modelo" name="modelo" defaultValue={articulo?.atributos.modelo} />
        <Campo label="Stock mínimo" name="stockMinimo" type="number" min={0} step="0.001" defaultValue={articulo?.stockMinimo ?? ""} ayuda="Avisa cuando el depósito queda por debajo." />
        <Campo label="Notas" name="notas" maxLength={500} defaultValue={articulo?.notas ?? ""} className="sm:col-span-2" />
      </fieldset>
      <MensajeError error={estado?.error} />
      <Ok estado={estado} />
      {editable && (
        <Button type="submit" disabled={pending}>
          {articulo?.id ? "Guardar cambios" : "Crear artículo"}
        </Button>
      )}
    </form>
  );
}

export function FormAjuste({ articuloId, unidad }: { articuloId: string; unidad: string }) {
  const [estado, onSubmit, pending] = useAccion(accionAjuste.bind(null, articuloId), undefined);
  const [tipo, setTipo] = useState<"ajuste" | "baja">("ajuste");
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-semibold">Ajuste del depósito</legend>
        {(["ajuste", "baja"] as const).map((t) => (
          <label key={t} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="size-4 accent-primary" />
            {t === "ajuste" ? "Ajuste de inventario (±)" : "Baja (rotura, pérdida)"}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label={`Cantidad (${unidad})`} name="cantidad" type="number" step="0.001" required ayuda={tipo === "ajuste" ? "Negativo para descontar." : undefined} />
        <Campo label="Motivo" name="motivo" required maxLength={200} />
      </div>
      <MensajeError error={estado?.error} />
      <Ok estado={estado} />
      <Button type="submit" variant="outline" disabled={pending}>
        Registrar
      </Button>
    </form>
  );
}

type Opcion = { id: string; nombre: string };
type LineaCompra = { key: number; articuloId: string; nombreNuevo: string; categoriaNueva: string; cantidad: string; precio: string };

/** RF-COM-01..03: compra con líneas; proveedor opcional (existente o nuevo); destino depósito u obra. */
export function FormCompra({ articulos, proveedores, obras }: { articulos: (Opcion & { unidad: string })[]; proveedores: Opcion[]; obras: Opcion[] }) {
  const nueva = (key: number): LineaCompra => ({ key, articuloId: "", nombreNuevo: "", categoriaNueva: CATEGORIAS_ARTICULO[0], cantidad: "", precio: "" });
  const [lineas, setLineas] = useState<LineaCompra[]>([nueva(0)]);
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [proveedor, setProveedor] = useState("");
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  const cambiar = (key: number, c: Partial<LineaCompra>) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...c } : l)));
  const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precio) || 0), 0);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => (String(fd.get(k) ?? "").trim() || null);
        start(async () => {
          const r = await accionRegistrarCompra(
            JSON.stringify({
              fecha: v("fecha"),
              proveedorId: proveedor && proveedor !== "nuevo" ? proveedor : null,
              proveedorNuevo: proveedor === "nuevo" ? v("proveedorNuevo") : null,
              destinoPresupuestoId: v("destino"),
              moneda,
              tipoCambio: moneda === "USD" ? Number(v("tipoCambio")) : null,
              lineas: lineas.map((l) => ({
                articuloId: l.articuloId && l.articuloId !== "nuevo" ? l.articuloId : null,
                nuevo: l.articuloId === "nuevo" ? { nombre: l.nombreNuevo, categoria: l.categoriaNueva, unidad: "u" } : null,
                cantidad: Number(l.cantidad),
                precioUnitario: Number(l.precio),
              })),
            }),
          );
          setEstado(r);
          if (r?.ok) setLineas([nueva(Date.now())]);
        });
      }}
    >
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoyAR()} max={hoyAR()} />
        <div className="space-y-1.5">
          <Label htmlFor="destino">Destino</Label>
          <select id="destino" name="destino" defaultValue="" className={select}>
            <option value="">Depósito</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                Directo a la obra {o.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proveedor">Proveedor (opcional)</Label>
          <select id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={select}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
            <option value="nuevo">Nuevo proveedor…</option>
          </select>
        </div>
        {proveedor === "nuevo" && <Campo label="Nombre del proveedor" name="proveedorNuevo" required maxLength={120} />}
        <div className="space-y-1.5">
          <Label htmlFor="moneda">Moneda</Label>
          <select id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={select}>
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        {moneda === "USD" && <Campo label="Tipo de cambio (pesos por dólar)" name="tipoCambio" type="number" min={0.0001} step="0.0001" required />}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">Artículos</legend>
        {lineas.map((l, i) => (
          <div key={l.key} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`art-${l.key}`}>Artículo {i + 1}</Label>
              <select id={`art-${l.key}`} required value={l.articuloId} onChange={(e) => cambiar(l.key, { articuloId: e.target.value })} className={select}>
                <option value="" disabled>
                  Elegí…
                </option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.unidad})
                  </option>
                ))}
                <option value="nuevo">Artículo nuevo…</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`cant-${l.key}`}>Cantidad</Label>
              <Input id={`cant-${l.key}`} type="number" min={0.001} step="0.001" required value={l.cantidad} onChange={(e) => cambiar(l.key, { cantidad: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`precio-${l.key}`}>Precio unitario</Label>
              <Input id={`precio-${l.key}`} type="number" min={0} step="0.01" required value={l.precio} onChange={(e) => cambiar(l.key, { precio: e.target.value })} className="h-11" />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar artículo ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2 />
            </Button>
            {l.articuloId === "nuevo" && (
              <div className="grid gap-2 sm:col-span-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`nuevo-${l.key}`}>Nombre del artículo nuevo</Label>
                  <Input id={`nuevo-${l.key}`} required value={l.nombreNuevo} onChange={(e) => cambiar(l.key, { nombreNuevo: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cat-${l.key}`}>Categoría</Label>
                  <select id={`cat-${l.key}`} value={l.categoriaNueva} onChange={(e) => cambiar(l.key, { categoriaNueva: e.target.value })} className={select}>
                    {CATEGORIAS_ARTICULO.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLineas((ls) => [...ls, nueva(Date.now())])}>
          <Plus data-icon="inline-start" /> Otro artículo
        </Button>
      </fieldset>

      <p className="text-right text-sm">
        Total: <strong className="tabular-nums">{new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda }).format(total)}</strong>
      </p>
      <p className="text-xs text-muted-foreground">El comprobante (factura o ticket) es opcional; podés subirlo como anexo de la obra.</p>
      <MensajeError error={estado?.error} />
      <Ok estado={estado} />
      <Button type="submit" size="lg" disabled={pending}>
        Registrar compra
      </Button>
    </form>
  );
}
