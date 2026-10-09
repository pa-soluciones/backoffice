"use client";

import { Camera, X } from "lucide-react";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ESTADOS_REGISTRO, type EstadoRegistro } from "@/domain/balance";
import { ELEMENTOS } from "@/domain/items";
import { guardar } from "@/lib/cola";
import { optimizarImagen } from "@/lib/imagen";
import type { DatosRegistro } from "@/services/campo";

type ItemCampo = { id: string; origen: string; descripcion: string; diametroMm: number | null; espesorCm: number | null; elemento: string | null };
type Inicial = Partial<Omit<DatosRegistro, "operarios">> & { operarios?: string[] };

const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";
const claveUltimo = (presupuestoId: string) => `pas-campo-ultimo-${presupuestoId}`;
const sinSuscripcion = () => () => {};
function leerUltimo(presupuestoId: string) {
  try {
    return localStorage.getItem(claveUltimo(presupuestoId));
  } catch {
    return null;
  }
}

/**
 * Registro de perforación (spec/07 RF-CMP-01..04). Sin `onGuardar` el alta va a la cola offline
 * (funciona sin conexión); con `onGuardar` (edición) se guarda directo.
 */
export function FormRegistro({
  presupuestoId,
  codigo,
  items,
  usuarios,
  yo,
  inicial,
  onGuardar,
}: {
  presupuestoId: string;
  codigo: string;
  items: ItemCampo[];
  usuarios: { id: string; name: string }[];
  yo: string;
  inicial?: Inicial | null;
  onGuardar?: (d: DatosRegistro) => Promise<{ error?: string } | undefined>;
}) {
  const form = useRef<HTMLFormElement>(null);
  // Alta en serie: precarga con lo último cargado en este dispositivo (sirve sin conexión).
  const guardado = useSyncExternalStore(sinSuscripcion, () => leerUltimo(presupuestoId), () => null);
  const [recien, setBase] = useState<Inicial | null>(null);
  const base: Inicial = recien ?? (guardado && !onGuardar ? { ...inicial, ...JSON.parse(guardado) } : (inicial ?? {}));
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [pending, start] = useTransition();

  const operariosIniciales = base.operarios?.length ? base.operarios : [yo];

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
    const d: DatosRegistro = {
      fecha: String(fd.get("fecha")),
      operarios: fd.getAll("operarios").map(String),
      piso: String(fd.get("piso")).trim(),
      elemento: String(fd.get("elemento")),
      espesorCm: n("espesorCm"),
      diametroMm: n("diametroMm"),
      cantidad: Number(fd.get("cantidad")),
      itemId: (fd.get("itemId") as string) || null,
      estado: fd.get("estado") as EstadoRegistro,
      observacion: (fd.get("observacion") as string)?.trim() || null,
    };
    if (!d.operarios.length) return setError("Elegí al menos un operario.");
    setError(undefined);
    setAviso(undefined);
    start(async () => {
      if (onGuardar) {
        const r = await onGuardar(d);
        if (r?.error) setError(r.error);
        return;
      }
      const optimizadas = await Promise.all(fotos.map((f) => optimizarImagen(f).catch(() => f)));
      await guardar({
        clientId: crypto.randomUUID(),
        presupuestoId,
        etiqueta: `${codigo} · Piso ${d.piso} · Ø${d.diametroMm} × ${d.cantidad}`,
        datos: d,
        fotos: optimizadas.map((f, i) => ({ archivo: f, nombre: f.name, tomadaAt: new Date(fotos[i].lastModified || Date.now()).toISOString() })),
        fotosSubidas: 0,
        creada: Date.now(),
      });
      const ultimo = { piso: d.piso, elemento: d.elemento, diametroMm: d.diametroMm, espesorCm: d.espesorCm, itemId: d.itemId, operarios: d.operarios, fecha: d.fecha };
      try {
        localStorage.setItem(claveUltimo(presupuestoId), JSON.stringify(ultimo));
      } catch {}
      setBase(ultimo);
      setFotos([]);
      form.current?.reset();
      setAviso(
        `Registro guardado (Piso ${d.piso}, Ø${d.diametroMm} × ${d.cantidad}).` +
          (fotos.length ? "" : " Sin evidencia fotográfica.") +
          (navigator.onLine ? "" : " Se envía cuando vuelva la conexión."),
      );
      window.dispatchEvent(new Event("pas-cola-nuevo"));
    });
  };

  return (
    // key: al cambiar la precarga se remontan los campos con sus nuevos valores por defecto.
    <form ref={form} key={JSON.stringify(base)} onSubmit={enviar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="piso">Piso</Label>
          <Input id="piso" name="piso" required maxLength={40} defaultValue={base.piso ?? ""} placeholder="17, PB, SS1…" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="elemento">Elemento</Label>
          <select id="elemento" name="elemento" required defaultValue={base.elemento ?? "Viga"} className={select}>
            {ELEMENTOS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="diametroMm">Ø (mm)</Label>
          <Input id="diametroMm" name="diametroMm" type="number" inputMode="decimal" min={1} step="0.1" required defaultValue={base.diametroMm ?? ""} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="espesorCm">Espesor (cm)</Label>
          <Input id="espesorCm" name="espesorCm" type="number" inputMode="decimal" min={0} step="0.1" defaultValue={base.espesorCm ?? ""} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input id="cantidad" name="cantidad" type="number" inputMode="numeric" min={1} step={1} required defaultValue={base.cantidad ?? 1} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={base.fecha ?? hoyAR()} max={hoyAR()} className="h-11" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <select id="estado" name="estado" defaultValue={base.estado ?? "finalizado"} className={select}>
            {Object.entries(ESTADOS_REGISTRO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="observacion">Observación</Label>
          <Input id="observacion" name="observacion" maxLength={500} defaultValue={base.observacion ?? ""} placeholder="1ra u. de 152 mm, interferencia con armadura…" className="h-11" />
        </div>
        {items.length > 0 && (
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="itemId">Ítem cotizado</Label>
            <select id="itemId" name="itemId" defaultValue={base.itemId ?? ""} className={select}>
              <option value="">Automático (por Ø, elemento y espesor)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.origen}: {i.descripcion}
                </option>
              ))}
            </select>
          </div>
        )}
        <fieldset className="col-span-2 space-y-1.5">
          <legend className="text-sm font-semibold">Operarios</legend>
          <div className="flex flex-wrap gap-2">
            {usuarios.map((u) => (
              <label key={u.id} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <input type="checkbox" name="operarios" value={u.id} defaultChecked={operariosIniciales.includes(u.id)} className="size-4 accent-primary" />
                {u.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {!onGuardar && (
        <div className="space-y-2">
          <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring">
            <Camera className="size-5" aria-hidden /> Foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              aria-label="Agregar fotos"
              className="sr-only"
              onChange={(e) => {
                const nuevas = [...(e.target.files ?? [])];
                setFotos((f) => [...f, ...nuevas]);
                e.target.value = "";
              }}
            />
          </label>
          {fotos.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {fotos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3">
                  {f.name}
                  <Button type="button" size="icon-xs" variant="ghost" aria-label={`Quitar ${f.name}`} onClick={() => setFotos((fs) => fs.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MensajeError error={error} />
      {aviso && (
        <p role="status" className="text-sm text-success">
          {aviso}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {onGuardar ? "Guardar cambios" : "Registrar"}
      </Button>
    </form>
  );
}
