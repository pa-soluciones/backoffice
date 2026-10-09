"use client";

import { Building2, Folder, HardHat, Search, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { accionBuscar } from "@/app/(app)/explorador/actions";
import type { Resultado } from "@/services/busqueda";
import { cn } from "@/lib/utils";

const GRUPOS: { tipo: Resultado["tipo"]; titulo: string; icon: LucideIcon }[] = [
  { tipo: "cliente", titulo: "Clientes", icon: Building2 },
  { tipo: "obra", titulo: "Obras", icon: Folder },
  { tipo: "director", titulo: "Directores de obra", icon: HardHat },
];

/** Buscador global (spec/04 §6). Ctrl/⌘+K abre; flechas navegan; Enter abre el resultado. */
export function Buscador() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  // Resultados junto al texto que los generó: nunca se muestran resultados de una búsqueda anterior.
  const [res, setRes] = useState<{ q: string; items: Resultado[] }>({ q: "", items: [] });
  const [sel, setSel] = useState(0);
  const [buscando, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(
      () =>
        start(async () => {
          setRes({ q, items: await accionBuscar(q) });
          setSel(0);
        }),
      200,
    );
    return () => clearTimeout(t);
  }, [q]);

  const actual = q.trim().length >= 2 && res.q === q;
  const visibles = actual ? res.items : [];
  const ordenados = GRUPOS.flatMap((g) => visibles.filter((r) => r.tipo === g.tipo));

  function abrir(r?: Resultado) {
    if (!r) return;
    dialog.current?.close();
    setQ("");
    router.push(r.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground hover:border-ring md:max-w-md"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Buscar cliente, dirección, director…</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-xs md:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialog}
        aria-label="Buscar"
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-0 mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, ordenados.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                abrir(ordenados[sel]);
              }
            }}
            placeholder="Cliente, dirección o director de obra"
            aria-label="Buscar"
            role="combobox"
            aria-expanded={ordenados.length > 0}
            aria-controls="resultados-busqueda"
            className="h-14 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <div id="resultados-busqueda" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="p-4 text-sm text-muted-foreground">Escribí al menos 2 letras. No importan mayúsculas ni acentos.</p>
          ) : ordenados.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{buscando || !actual ? "Buscando…" : "Sin resultados."}</p>
          ) : (
            GRUPOS.map((g) => {
              const items = ordenados.filter((r) => r.tipo === g.tipo);
              if (!items.length) return null;
              return (
                <div key={g.tipo} role="group" aria-label={g.titulo}>
                  <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">{g.titulo}</p>
                  {items.map((r) => {
                    const i = ordenados.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={i === sel}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => abrir(r)}
                        className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === sel && "bg-muted")}
                      >
                        <g.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{r.titulo}</span>
                          {r.detalle && <span className="block truncate text-sm text-muted-foreground">{r.detalle}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </dialog>
    </>
  );
}
