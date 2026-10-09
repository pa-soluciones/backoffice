import { LayoutGrid, List, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado } from "@/components/encabezado";
import { BonificadoBadge, EstadoBadge } from "@/components/estado-badge";
import { pagina as cortar, paginaDe, Paginador, POR_PAGINA } from "@/components/paginador";
import { buttonVariants } from "@/components/ui/button";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { ESTADOS, FINALES, type Estado } from "@/domain/workflow";
import { cn } from "@/lib/utils";
import { listarPresupuestos } from "@/services/presupuestos";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Seguimiento" };

const ACTIVOS = (Object.keys(ESTADOS) as Estado[]).filter((e) => !FINALES.includes(e));
const POR_COLUMNA = 8;
type Item = Awaited<ReturnType<typeof listarPresupuestos>>[number];

function Tarjeta({ p }: { p: Item }) {
  return (
    <Link href={`/presupuestos/${p.id}`} className="block space-y-1 rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:border-primary">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
        {p.bonificado && <BonificadoBadge />}
      </div>
      <p className="truncate text-sm font-medium">{p.cliente}</p>
      {p.obra && <p className="truncate text-xs text-muted-foreground">{p.obra}</p>}
      {p.total != null && <p className="pt-1 text-sm font-semibold tabular-nums">{formatearMonto(p.total, p.moneda)}</p>}
    </Link>
  );
}

function Fila({ p }: { p: Item }) {
  return (
    <li>
      <Link href={`/presupuestos/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-4 hover:bg-muted/60 md:grid-cols-[7rem_1fr_auto_auto]">
        <span className="font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
        <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
          <span className="block truncate font-medium">{p.cliente}</span>
          {p.obra && <span className="block truncate text-sm text-muted-foreground">{p.obra}</span>}
        </span>
        <span className="col-start-1 row-start-3 text-sm font-semibold tabular-nums md:col-start-auto md:row-start-auto">{p.total != null ? formatearMonto(p.total, p.moneda) : ""}</span>
        <span className="col-start-2 row-start-1 flex justify-end gap-1 md:col-start-auto">
          {p.bonificado && <BonificadoBadge />}
          <EstadoBadge estado={p.estado} />
        </span>
      </Link>
    </li>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("presupuestos", "leer");
  const sp = await searchParams;
  const vista = sp.vista === "lista" ? "lista" : "tablero";
  const estado = typeof sp.estado === "string" && sp.estado in ESTADOS ? (sp.estado as Estado) : undefined;
  const pag = paginaDe(sp.pagina);
  const [lista, activos, permisos] = await Promise.all([
    listarPresupuestos({ estado, limite: POR_PAGINA + 1, desde: (pag - 1) * POR_PAGINA }),
    listarPresupuestos({ estados: ACTIVOS }),
    getPermisos(usuario.id),
  ]);
  const { filas, hayMas } = cortar(lista);
  const qs = (c: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ vista, estado, ...c }).filter(([, v]) => v) as [string, string][])}`;
  const tab = (activa: boolean) => cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", activa ? "bg-muted font-semibold" : "text-muted-foreground hover:text-foreground");

  return (
    <>
      <Encabezado titulo="Seguimiento" bajada={`${activos.length} ${activos.length === 1 ? "presupuesto activo" : "presupuestos activos"}`}>
        <div role="group" aria-label="Vista" className="hidden rounded-lg border bg-card p-1 text-sm md:flex">
          <Link href={qs({ vista: "tablero", estado: undefined, pagina: undefined })} aria-current={vista === "tablero" ? "true" : undefined} className={tab(vista === "tablero")}>
            <LayoutGrid className="size-4" aria-hidden /> Tablero
          </Link>
          <Link href={qs({ vista: "lista" })} aria-current={vista === "lista" ? "true" : undefined} className={tab(vista === "lista")}>
            <List className="size-4" aria-hidden /> Lista
          </Link>
        </div>
        {alcanceDe(permisos, "presupuestos", "escribir") && (
          <Link href="/presupuestos/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Nuevo prospecto
          </Link>
        )}
      </Encabezado>

      {/* Tablero: solo desktop, presupuestos activos. */}
      {vista === "tablero" && (
        <div className="hidden gap-3 md:grid md:grid-cols-5">
          {ACTIVOS.map((e) => {
            const col = activos.filter((p) => p.estado === e);
            return (
              <section key={e} aria-label={ESTADOS[e]} className="min-w-0 space-y-2 rounded-xl bg-muted/70 p-2">
                <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-semibold">
                  <EstadoBadge estado={e} />
                  <span className="text-muted-foreground tabular-nums">{col.length}</span>
                </h2>
                {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Ninguno</p>}
                {col.slice(0, POR_COLUMNA).map((p) => (
                  <Tarjeta key={p.id} p={p} />
                ))}
                {col.length > POR_COLUMNA && (
                  <Link href={qs({ vista: "lista", estado: e })} className="block rounded-lg px-2 py-2 text-center text-sm font-semibold text-primary-text hover:bg-card">
                    Ver los {col.length}
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className={cn("space-y-3", vista === "tablero" && "md:hidden")}>
        <nav aria-label="Filtrar por estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <Link href={qs({ estado: undefined })} className={cn("rounded-full border bg-card px-3 py-1.5 text-sm whitespace-nowrap", !estado && "border-primary bg-accent font-semibold")}>
            Todos
          </Link>
          {(Object.keys(ESTADOS) as Estado[]).map((e) => (
            <Link key={e} href={qs({ estado: e })} className={cn("rounded-full border bg-card px-3 py-1.5 text-sm whitespace-nowrap", estado === e && "border-primary bg-accent font-semibold")}>
              {ESTADOS[e]}
            </Link>
          ))}
        </nav>
        {filas.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">No hay presupuestos{estado ? ` en ${ESTADOS[estado]}` : ""}.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {filas.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </ul>
        )}
        <Paginador pagina={pag} hayMas={hayMas} mostrando={filas.length} params={{ vista, estado }} />
      </div>
    </>
  );
}

export default function SeguimientoPage({ searchParams }: PageProps<"/presupuestos">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
