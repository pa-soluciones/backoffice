import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { ESTADOS, type Estado } from "@/domain/workflow";
import { finanzasEmpresa } from "@/services/finanzas";
import { categorias, listarGastos } from "@/services/gastos";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { ListaGastos } from "../presupuestos/_componentes/gastos";
import { FormGasto } from "../campo/_componentes/form-gasto";

export const metadata: Metadata = { title: "Finanzas" };

const TZ = "America/Argentina/Buenos_Aires";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const nombreMes = (m: string) => new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${m}-15T00:00:00Z`));

/** ?periodo=2026-10 (mes) | 2026-T4 (trimestre) | 2026 (año). Por defecto, el mes actual. */
function rango(periodo: string | undefined) {
  const p = periodo && /^\d{4}(-\d{2}|-T[1-4])?$/.test(periodo) ? periodo : hoy().slice(0, 7);
  const anio = Number(p.slice(0, 4));
  const fin = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); // último día del mes m (1-12)
  if (/^\d{4}$/.test(p)) return { p, desde: `${anio}-01-01`, hasta: `${anio}-12-31`, titulo: String(anio) };
  if (p.includes("-T")) {
    const t = Number(p.at(-1));
    return { p, desde: `${anio}-${String(t * 3 - 2).padStart(2, "0")}-01`, hasta: fin(anio, t * 3), titulo: `${t}° trimestre ${anio}` };
  }
  const m = Number(p.slice(5, 7));
  return { p, desde: `${p}-01`, hasta: fin(anio, m), titulo: new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${p}-15T00:00:00Z`)) };
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("finanzas", "leer");
  const sp = await searchParams;
  const { p, desde, hasta, titulo } = rango(typeof sp.periodo === "string" ? sp.periodo : undefined);
  const permisos = await getPermisos(usuario.id);
  const verGastos = alcanceDe(permisos, "gastos", "leer") === "todos";
  const [f, generales, cats] = await Promise.all([finanzasEmpresa(desde, hasta), verGastos ? listarGastos({ presupuestoId: null, desde, hasta }) : null, categorias()]);
  const max = Math.max(1, ...f.porMes.flatMap((x) => [x.ingresosArs, x.egresosArs]));
  const actual = hoy();
  const periodos = [
    { p: actual.slice(0, 7), t: "Este mes" },
    { p: `${actual.slice(0, 4)}-T${Math.ceil(Number(actual.slice(5, 7)) / 3)}`, t: "Este trimestre" },
    { p: actual.slice(0, 4), t: "Este año" },
  ];

  return (
    <>
      <nav aria-label="Período" className="flex flex-wrap items-center gap-1">
        {periodos.map((x) => (
          <Link key={x.p} href={`?periodo=${x.p}`} aria-current={x.p === p ? "page" : undefined} className={buttonVariants({ variant: x.p === p ? "secondary" : "ghost", size: "sm" })}>
            {x.t}
          </Link>
        ))}
        <span className="ml-2 text-sm text-muted-foreground capitalize">{titulo}</span>
      </nav>

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Cobrado (pesos)", formatearMonto(f.totales.ingresosArs)],
          ["Egresos (compras y gastos)", formatearMonto(f.totales.egresosArs)],
          ["Resultado en pesos", formatearMonto(f.totales.resultadoArs)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {f.totales.ingresosUsd > 0 && <p className="text-sm text-muted-foreground">Además se cobraron {formatearMonto(f.totales.ingresosUsd, "USD")} en presupuestos en dólares.</p>}

      {f.porMes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Por mes</h2>
          <ul className="space-y-3 rounded-xl border bg-card p-4 text-sm">
            {f.porMes.map((x) => (
              <li key={x.mes} className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-1">
                <span className="row-span-2 capitalize">{nombreMes(x.mes)}</span>
                <span className="flex items-center gap-2">
                  <span className="h-3 rounded-full bg-success" style={{ width: `${(x.ingresosArs / max) * 100}%` }} aria-hidden />
                  <span className="tabular-nums">Cobrado {formatearMonto(x.ingresosArs)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 rounded-full bg-primary" style={{ width: `${(x.egresosArs / max) * 100}%` }} aria-hidden />
                  <span className="tabular-nums">Egresos {formatearMonto(x.egresosArs)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cobros pendientes</h2>
        <dl className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-4 text-sm">
          {(["0-30", "31-60", "60+"] as const).map((t) => (
            <div key={t}>
              <dt className="text-muted-foreground">{t === "60+" ? "Más de 60 días" : `${t} días`}</dt>
              <dd className="font-semibold tabular-nums">{formatearMonto(f.pendientes.tramos[t].ARS)}</dd>
              {f.pendientes.tramos[t].USD > 0 && <dd className="tabular-nums">{formatearMonto(f.pendientes.tramos[t].USD, "USD")}</dd>}
            </div>
          ))}
        </dl>
        {f.pendientes.detalle.length > 0 && (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {f.pendientes.detalle.slice(0, 20).map((d, i) => (
              <li key={i}>
                <Link href={`/presupuestos/${d.presupuestoId}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{d.codigo}</span>
                    <span className="block text-xs text-muted-foreground">{d.concepto}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{d.dias} días</span>
                  <span className="tabular-nums">{formatearMonto(d.pendiente, d.moneda)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Presupuestos por margen</h2>
        {f.ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin presupuestos en curso ni terminados.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {f.ranking.map((r) => (
              <li key={r.id}>
                <Link href={`/presupuestos/${r.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.codigo}</span>
                    <span className="block text-xs text-muted-foreground">{[r.cliente, ESTADOS[r.estado as Estado]].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="tabular-nums">{r.resultado == null ? "—" : formatearMonto(r.resultado, r.moneda)}</span>
                  <span className="w-16 text-right font-semibold tabular-nums">{r.margen == null ? "—" : `${r.margen.toLocaleString("es-AR")}%`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {f.gastosPorCategoria.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Gastos por categoría</h2>
          <dl className="divide-y rounded-xl border bg-card text-sm">
            {f.gastosPorCategoria.map((g) => (
              <div key={g.categoria} className="flex justify-between p-3">
                <dt>{g.categoria}</dt>
                <dd className="tabular-nums">{formatearMonto(g.importe)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {generales && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Gastos generales de la empresa</h2>
          <ListaGastos gastos={generales} puedeEliminar={alcanceDe(permisos, "gastos", "eliminar") === "todos"} />
          {alcanceDe(permisos, "gastos", "escribir") === "todos" && <FormGasto presupuestoId={null} categorias={cats} />}
        </section>
      )}
    </>
  );
}

export default function FinanzasPage({ searchParams }: PageProps<"/finanzas">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Finanzas</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
