import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { DEPOSITO, TIPOS_MOVIMIENTO } from "@/domain/stock";
import { ErrorNegocio } from "@/services/errores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { movimientosArticulo, obtenerArticulo } from "@/services/stock";
import { FormAjuste, FormArticulo } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Artículo" };

const cant = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const LUGAR: Record<string, string> = { deposito: "Depósito", proveedor: "Proveedor", consumido: "Consumido", baja: "Baja", ajuste: "Ajuste" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("stock", "leer");
  const { id } = await params;
  let a, movs;
  try {
    [a, movs] = await Promise.all([obtenerArticulo(id), movimientosArticulo(id)]);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const editable = !!alcanceDe(await getPermisos(usuario.id), "stock", "escribir");
  const lugar = (u: string, obra: string | null) => LUGAR[u] ?? (obra ? `Obra ${obra}` : "Obra");
  return (
    <>
      <Migas items={[{ href: "/stock", label: "Stock" }, { label: a.nombre }]} />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">{a.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          En depósito: <strong className="text-foreground">{cant.format(a.deposito)} {a.unidad}</strong>
          {a.costo != null && ` · Costo promedio ${formatearMonto(a.costo)}`}
        </p>
      </header>
      {editable && <FormAjuste articuloId={a.id} unidad={a.unidad} />}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Movimientos</h2>
        {movs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {movs.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {TIPOS_MOVIMIENTO[m.tipo]} · {cant.format(m.cantidad)} {a.unidad}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[dia(m.fecha), `${lugar(m.desde, m.desde === DEPOSITO ? null : m.obra)} → ${lugar(m.hacia, m.hacia === DEPOSITO ? null : m.obra)}`, m.motivo, m.autor].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {m.costoUnitario != null && <span className="text-xs text-muted-foreground tabular-nums">{formatearMonto(m.costoUnitario)} c/u</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Datos del artículo</h2>
        <FormArticulo articulo={{ ...a, atributos: a.atributos }} editable={editable} />
      </section>
    </>
  );
}

export default function ArticuloPage({ params }: PageProps<"/stock/[id]">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
