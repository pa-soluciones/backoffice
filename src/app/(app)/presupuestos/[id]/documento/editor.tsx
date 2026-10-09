"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { variablesDesconocidas } from "@/domain/bloques";
import { armar, BLOQUES, variables, type DatosPresupuesto } from "@/documents/presupuesto";
import { cn } from "@/lib/utils";
import { accionGuardarBloques, accionRestaurarVersion } from "../../actions";
import { VistaPrevia } from "./vista-previa";

type Version = { nro: number; origen: string; at: Date; usuario: string | null };

const hora = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const ORIGEN: Record<string, string> = { usuario: "", ia: " · IA", mcp: " · MCP", sistema: " · inicial" };
const AUTOGUARDADO_MS = 30_000;
/** Alto del campo según el texto (≈48 caracteres por renglón en el ancho del panel). */
const filas = (t: string) => Math.min(12, Math.max(2, t.split("\n").reduce((n, l) => n + Math.ceil((l.length || 1) / 48), 0)));

export function EditorDocumento({
  documentoId,
  presupuestoId,
  datos,
  inicial,
  defaults,
  editable,
  versiones,
}: {
  documentoId: string;
  presupuestoId: string;
  datos: DatosPresupuesto;
  inicial: Record<string, string>;
  defaults: Record<string, string>;
  editable: boolean;
  versiones: Version[];
}) {
  const [bloques, setBloques] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [activo, setActivo] = useState<string | null>(null);
  const [vista, setVista] = useState<"editar" | "previa">("editar");
  const [estado, setEstado] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const campos = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const sucio = BLOQUES.some((b) => bloques[b.id] !== guardado[b.id]);
  const vars = useMemo(() => variables(datos), [datos]);
  const doc = useMemo(() => armar(datos, bloques), [datos, bloques]);

  const guardar = () =>
    start(async () => {
      const copia = bloques;
      const r = await accionGuardarBloques(documentoId, presupuestoId, JSON.stringify(copia));
      if (!r.error) setGuardado(copia);
      setEstado(r);
    });

  // Autoguardado (RF-DOC-02) y aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio || !editable) return;
    const t = setTimeout(guardar, AUTOGUARDADO_MS);
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeunload", avisar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guardar usa el estado actual
  }, [bloques, sucio, editable]);

  const elegir = (id: string) => {
    setActivo(id);
    setVista("editar");
    requestAnimationFrame(() => campos.current[id]?.focus());
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Vista" className="flex rounded-lg border bg-card p-1 text-sm lg:hidden">
        {(["editar", "previa"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={cn("flex-1 rounded-md py-2", vista === v ? "bg-muted font-semibold" : "text-muted-foreground")}>
            {v === "editar" ? "Textos" : "Vista previa"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section aria-label="Textos del documento" className={cn("space-y-4", vista === "previa" && "hidden lg:block")}>
          {!editable && (
            <p className="rounded-lg bg-muted p-3 text-sm">Este documento ya está emitido: solo lectura. Para cambiarlo, creá una nueva revisión del presupuesto.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Una línea = un párrafo. Usá **así** para negrita. Podés usar variables: {Object.keys(vars).map((v) => `{${v}}`).join(", ")}.
          </p>
          {BLOQUES.map((b) => {
            const desconocidas = variablesDesconocidas(bloques[b.id] ?? "", vars);
            return (
              <div key={b.id} className={cn("space-y-1.5 rounded-xl border bg-card p-3", activo === b.id && "border-primary")}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`b-${b.id}`} className="text-sm font-semibold">
                    {b.titulo}
                  </label>
                  {editable && bloques[b.id] !== defaults[b.id] && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => setBloques((x) => ({ ...x, [b.id]: defaults[b.id] }))} title="Volver al texto por defecto">
                      <RotateCcw data-icon="inline-start" /> Por defecto
                    </Button>
                  )}
                </div>
                {b.ayuda && <p className="text-xs text-muted-foreground">{b.ayuda}</p>}
                <textarea
                  id={`b-${b.id}`}
                  ref={(el) => {
                    campos.current[b.id] = el;
                  }}
                  value={bloques[b.id] ?? ""}
                  readOnly={!editable}
                  onFocus={() => setActivo(b.id)}
                  onChange={(e) => setBloques((x) => ({ ...x, [b.id]: e.target.value }))}
                  rows={filas(bloques[b.id] ?? "")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                />
                {desconocidas.length > 0 && <p className="text-xs text-warning">Variable desconocida: {desconocidas.map((v) => `{${v}}`).join(", ")}</p>}
              </div>
            );
          })}

          {editable && (
            <div className="sticky bottom-20 z-10 space-y-2 rounded-xl border bg-card p-3 shadow-lg md:bottom-4">
              <MensajeError error={estado?.error} />
              <div className="flex items-center gap-3">
                <Button type="button" onClick={guardar} disabled={pending || !sucio}>
                  {pending ? "Guardando…" : "Guardar versión"}
                </Button>
                <span role="status" className="text-sm text-muted-foreground">
                  {sucio ? "Cambios sin guardar (se guardan solos a los 30 s)" : "Todo guardado"}
                </span>
              </div>
            </div>
          )}

          <details className="rounded-xl border bg-card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Versiones ({versiones.length})</summary>
            <ol className="mt-2 divide-y">
              {versiones.map((v) => (
                <li key={v.nro} className="flex items-center gap-2 py-2">
                  <span className="font-mono tabular-nums">v{v.nro}</span>
                  <span className="flex-1 text-muted-foreground">
                    {hora.format(v.at)} · {v.usuario ?? "—"}
                    {ORIGEN[v.origen] ?? ""}
                  </span>
                  {editable && v.nro !== versiones[0]?.nro && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={pending}
                      onClick={() => {
                        if (sucio && !confirm("Tenés cambios sin guardar que se van a perder. ¿Restaurar igual?")) return;
                        start(async () => {
                          const r = await accionRestaurarVersion(documentoId, presupuestoId, v.nro);
                          setEstado(r);
                          if (r.bloques) {
                            setBloques(r.bloques);
                            setGuardado(r.bloques);
                          }
                        });
                      }}
                    >
                      Restaurar
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </details>
        </section>

        <section aria-label="Vista previa" className={cn("min-w-0 overflow-x-auto rounded-xl bg-muted p-2 sm:p-4", vista === "editar" && "hidden lg:block")}>
          <div className="lg:sticky lg:top-20">
            <VistaPrevia d={doc} activo={activo} onElegir={editable ? elegir : undefined} />
          </div>
        </section>
      </div>
    </div>
  );
}
