import { AlertTriangle, Package, Plus, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado } from "@/components/encabezado";
import { pagina as cortar, paginaDe, Paginador, POR_PAGINA } from "@/components/paginador";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearMonto } from "@/domain/montos";
import { cn } from "@/lib/utils";
import { listarArticulos } from "@/services/stock";

export const metadata: Metadata = { title: "Stock" };

const cant = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

async function Lista({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const pag = paginaDe(sp.pagina);
  const { filas: arts, hayMas } = cortar(await listarArticulos(q, { limite: POR_PAGINA + 1, desde: (pag - 1) * POR_PAGINA }));
  const bajos = arts.filter((a) => a.bajoMinimo).length;
  return (
    <>
      {bajos > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <strong>{bajos}</strong> {bajos === 1 ? "artículo está" : "artículos están"} por debajo del stock mínimo.
          </span>
        </p>
      )}
      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar artículo…" aria-label="Buscar artículo" className="h-11 max-w-sm" />
      </form>
      {arts.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 size-6" aria-hidden />
          {q ? "Sin resultados." : "Todavía no hay artículos. Se crean al registrar una compra o desde “Nuevo artículo”."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {arts.map((a) => (
            <li key={a.id}>
              <Link href={`/stock/${a.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-3 hover:bg-muted sm:grid-cols-[1fr_auto_7rem_8rem]">
                <span className="min-w-0">
                  <span className="block font-semibold">{a.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{[a.categoria, a.atributos.diametro && `Ø${a.atributos.diametro}`, a.atributos.marca].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={cn("text-right text-lg font-semibold tabular-nums sm:order-3", a.bajoMinimo && "text-warning", a.stock <= 0 && "text-muted-foreground")}>
                  {cant.format(a.stock)} <span className="text-sm font-normal">{a.unidad}</span>
                </span>
                <span className="text-xs sm:order-2">
                  {a.bajoMinimo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                      <AlertTriangle className="size-3" aria-hidden /> Bajo mínimo ({cant.format(a.minimo!)})
                    </span>
                  )}
                </span>
                {a.costo != null && <span className="text-right text-xs text-muted-foreground tabular-nums sm:order-4">{formatearMonto(a.costo)} c/u</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Paginador pagina={pag} hayMas={hayMas} mostrando={arts.length} params={{ q: q || undefined }} />
    </>
  );
}

export default function StockPage({ searchParams }: PageProps<"/stock">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Encabezado titulo="Stock" bajada="Stock del depósito. Lo asignado a cada obra se ve en el presupuesto, pestaña Obra.">
        <Link href="/stock/nuevo" className={buttonVariants({ variant: "outline" })}>
          <Plus data-icon="inline-start" /> Nuevo artículo
        </Link>
        <Link href="/stock/compra" className={buttonVariants()}>
          <ShoppingCart data-icon="inline-start" /> Registrar compra
        </Link>
      </Encabezado>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
