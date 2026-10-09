import { AlertTriangle, Package, Plus, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearMonto } from "@/domain/montos";
import { listarArticulos } from "@/services/stock";

export const metadata: Metadata = { title: "Stock" };

const cant = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

async function Lista({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const arts = await listarArticulos(q);
  return (
    <>
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
              <Link href={`/stock/${a.id}`} className="flex min-h-14 flex-wrap items-center gap-3 p-3 hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{[a.categoria, a.atributos.diametro && `Ø${a.atributos.diametro}`, a.atributos.marca].filter(Boolean).join(" · ")}</span>
                </span>
                {a.bajoMinimo && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary-text">
                    <AlertTriangle className="size-3.5" aria-hidden /> Bajo mínimo ({cant.format(a.minimo!)})
                  </span>
                )}
                <span className="w-24 text-right tabular-nums">
                  {cant.format(a.stock)} {a.unidad}
                </span>
                {a.costo != null && <span className="w-32 text-right text-xs text-muted-foreground tabular-nums">{formatearMonto(a.costo)} c/u</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function StockPage({ searchParams }: PageProps<"/stock">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold md:text-3xl">Stock</h1>
        <Link href="/stock/nuevo" className={buttonVariants({ variant: "outline" })}>
          <Plus data-icon="inline-start" /> Nuevo artículo
        </Link>
        <Link href="/stock/compra" className={buttonVariants()}>
          <ShoppingCart data-icon="inline-start" /> Registrar compra
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">Stock del depósito. Lo asignado a cada obra se ve en el presupuesto, en Materiales.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
