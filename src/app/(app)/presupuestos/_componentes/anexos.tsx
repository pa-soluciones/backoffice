"use client";

import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ACCEPT, CATEGORIAS_ANEXO, mimePorNombre } from "@/domain/archivos";
import { formatearBytes } from "@/domain/cuota-r2";
import { optimizarImagen } from "@/lib/imagen";
import { accionConfirmarAnexo, accionEliminarAnexo, accionPrepararAnexo, accionUrlAnexo } from "../actions";

type Anexo = { id: string; nombre: string; mime: string; bytes: number; categoria: string | null; autor: string | null; createdAt: Date };

const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const MAX = 30 * 1024 * 1024;

/** Anexos del presupuesto (spec/06 §7). Las imágenes se optimizan en el navegador antes de subir. */
export function Anexos({ presupuestoId, anexos, puedeSubir, puedeEliminar }: { presupuestoId: string; anexos: Anexo[]; puedeSubir: boolean; puedeEliminar: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_ANEXO[0]);
  const [progreso, setProgreso] = useState<string>();
  const [errores, setErrores] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const subir = (archivos: File[]) =>
    start(async () => {
      const fallas: string[] = [];
      for (const [i, original] of archivos.entries()) {
        setProgreso(`Subiendo ${i + 1} de ${archivos.length}: ${original.name}`);
        if (original.size > MAX) {
          fallas.push(`${original.name}: supera los 30 MB.`);
          continue;
        }
        const archivo = await optimizarImagen(original).catch(() => original);
        const mime = archivo.type || mimePorNombre(archivo.name) || "";
        const r = await accionPrepararAnexo(presupuestoId, { nombre: archivo.name, mime, bytes: archivo.size, categoria, descripcion: null });
        if ("error" in r) {
          fallas.push(`${original.name}: ${r.error}`);
          continue;
        }
        const put = await fetch(r.url, { method: "PUT", body: archivo, headers: { "Content-Type": mime } }).catch(() => null);
        if (!put?.ok) {
          fallas.push(`${original.name}: no se pudo subir (revisá la conexión).`);
          continue;
        }
        const c = await accionConfirmarAnexo(presupuestoId, r.archivoId);
        if (c?.error) fallas.push(`${original.name}: ${c.error}`);
      }
      setProgreso(undefined);
      setErrores(fallas);
      if (input.current) input.current.value = "";
    });

  const abrir = (id: string) =>
    start(async () => {
      const r = await accionUrlAnexo(id);
      if ("url" in r) window.location.assign(r.url);
      else setErrores([r.error]);
    });

  return (
    <div className="space-y-3">
      {puedeSubir && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <div className="space-y-1.5">
            <Label htmlFor="categoria-anexo">Categoría</Label>
            <select id="categoria-anexo" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-base md:text-sm">
              {CATEGORIAS_ANEXO.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Elegir archivos para adjuntar"
            className="sr-only"
            onChange={(e) => e.target.files?.length && subir([...e.target.files])}
          />
          <Button type="button" disabled={pending} onClick={() => input.current?.click()}>
            <Upload data-icon="inline-start" /> Adjuntar archivos
          </Button>
          <p className="w-full text-xs text-muted-foreground">Fotos, PDF, Word, Excel o planos DWG, hasta 30 MB. Las fotos se achican antes de subir.</p>
          {progreso && (
            <p role="status" className="w-full text-sm">
              {progreso}
            </p>
          )}
        </div>
      )}
      {errores.map((e) => (
        <MensajeError key={e} error={e} />
      ))}

      {anexos.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          <Paperclip className="mx-auto mb-2 size-6" aria-hidden />
          Sin archivos adjuntos.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {anexos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              {a.mime.startsWith("image/") ? <ImageIcon className="size-5 text-muted-foreground" aria-hidden /> : <FileText className="size-5 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {[a.categoria, formatearBytes(a.bytes), a.autor, fecha.format(a.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => abrir(a.id)} aria-label={`Abrir ${a.nombre}`}>
                <Download data-icon="inline-start" /> Abrir
              </Button>
              {puedeEliminar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={`Eliminar ${a.nombre}`}
                  onClick={() => {
                    if (!confirm(`¿Eliminar "${a.nombre}"?`)) return;
                    start(async () => {
                      const r = await accionEliminarAnexo(presupuestoId, a.id);
                      setErrores(r?.error ? [r.error] : []);
                    });
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
