import { LayoutGrid, List, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BonificadoBadge, EstadoBadge } from "@/components/estado-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { ESTADOS, FINALES, type Estado } from "@/domain/workflow";
import { cn } from "@/lib/utils";
import { listarPresupuestos } from "@/services/presupuestos";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Seguimiento" };

const ACTIVOS = (Object.keys(ESTADOS) as Estado[]).filter((e) => !FINALES.includes(e));
type Item = Awaited<ReturnType<typeof listarPresupuestos>>[number];

function Tarjeta({ p }: { p: Item }) {
  return (
    <Link href={`/presupuestos/${p.id}`} className="block space-y-1 rounded-lg border bg-card p-3 hover:border-ring">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
        {p.bonificado && <BonificadoBadge />}
      </div>
      <p className="truncate text-sm font-semibold">{p.cliente}</p>
      {p.obra && <p className="truncate text-xs text-muted-foreground">{p.obra}</p>}
      {p.total != null && <p className="text-sm tabular-nums">{formatearMonto(p.total, p.moneda)}</p>}
    </Link>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("presupuestos", "leer");
  const sp = await searchParams;
  const vista = sp.vista === "lista" ? "lista" : "tablero";
  const estado = typeof sp.estado === "string" && sp.estado in ESTADOS ? (sp.estado as Estado) : undefined;
  const [lista, permisos] = await Promise.all([listarPresupuestos({ estado }), getPermisos(usuario.id)]);
  const qs = (c: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.entries({ vista, estado, ...c }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista" className="hidden rounded-lg border bg-card p-1 text-sm md:flex">
          <Link href={qs({ vista: "tablero", estado: undefined })} aria-current={vista === "tablero" ? "true" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", vista === "tablero" ? "bg-muted font-semibold" : "text-muted-foreground")}>
            <LayoutGrid className="size-4" aria-hidden /> Tablero
          </Link>
          <Link href={qs({ vista: "lista" })} aria-current={vista === "lista" ? "true" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", vista === "lista" ? "bg-muted font-semibold" : "text-muted-foreground")}>
            <List className="size-4" aria-hidden /> Lista
          </Link>
        </div>
        {alcanceDe(permisos, "presupuestos", "escribir") && (
          <Link href="/presupuestos/nuevo" className={buttonVariants({ className: "ml-auto" })}>
            <Plus data-icon="inline-start" /> Nuevo prospecto
          </Link>
        )}
      </div>

      {/* Tablero: solo desktop y sin filtro de estado. */}
      {vista === "tablero" && (
        <div className="hidden gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5">
          {ACTIVOS.map((e) => {
            const col = lista.filter((p) => p.estado === e);
            return (
              <section key={e} aria-label={ESTADOS[e]} className="min-w-44 space-y-2 rounded-xl bg-muted/60 p-2">
                <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-semibold">
                  <EstadoBadge estado={e} />
                  <span className="text-muted-foreground tabular-nums">{col.length}</span>
                </h2>
                {col.map((p) => (
                  <Tarjeta key={p.id} p={p} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <div className={cn("space-y-3", vista === "tablero" && "md:hidden")}>
        <nav aria-label="Filtrar por estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <Link href={qs({ estado: undefined })} className={cn("rounded-full border px-3 py-1 text-sm whitespace-nowrap", !estado && "border-primary bg-primary/15 font-semibold")}>
            Todos
          </Link>
          {(Object.keys(ESTADOS) as Estado[]).map((e) => (
            <Link key={e} href={qs({ estado: e })} className={cn("rounded-full border px-3 py-1 text-sm whitespace-nowrap", estado === e && "border-primary bg-primary/15 font-semibold")}>
              {ESTADOS[e]}
            </Link>
          ))}
        </nav>
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">No hay presupuestos{estado ? ` en ${ESTADOS[estado]}` : ""}.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {lista.map((p) => (
              <li key={p.id}>
                <Link href={`/presupuestos/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 hover:bg-muted/60">
                  <span className="w-24 font-mono text-sm font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.cliente}</span>
                    {p.obra && <span className="block truncate text-sm text-muted-foreground">{p.obra}</span>}
                  </span>
                  {p.total != null && <span className="text-sm tabular-nums">{formatearMonto(p.total, p.moneda)}</span>}
                  <span className="flex gap-1">
                    {p.bonificado && <BonificadoBadge />}
                    <EstadoBadge estado={p.estado} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function SeguimientoPage({ searchParams }: PageProps<"/presupuestos">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Seguimiento</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
