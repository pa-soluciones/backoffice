import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EstadoAdicionalBadge } from "@/components/estado-badge";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { UNIDADES } from "@/domain/items";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { obtenerAdicional } from "@/services/adicionales";
import { ErrorNegocio } from "@/services/errores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { accionGuardarItemsAdicional } from "../../../actions";
import { AccionesAdicional, CondicionesAdicional } from "../../../_componentes/adicional";
import { Descargas } from "../../../_componentes/descargas";
import { ItemsEditor } from "../../../_componentes/items-editor";

export const metadata: Metadata = { title: "Trabajo adicional" };

async function Contenido({ params }: { params: Promise<{ id: string; adId: string }> }) {
  const { usuario } = await requirePermiso("presupuestos", "leer");
  const { id, adId } = await params;
  let a;
  try {
    a = await obtenerAdicional(adId);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  if (a.presupuestoId !== id) notFound();
  const permisos = await getPermisos(usuario.id);
  const puede = (m: Parameters<typeof alcanceDe>[1], ac: Parameters<typeof alcanceDe>[2]) => !!alcanceDe(permisos, m, ac);
  const borrador = a.estado === "borrador";
  const editable = borrador && a.verMontos && puede("presupuestos", "escribir");

  return (
    <>
      <Migas
        items={[
          { href: "/presupuestos", label: "Seguimiento" },
          { href: `/presupuestos/${id}`, label: a.presupuesto.codigo ?? "Sin numerar" },
          { label: `Adicional ${a.nro}` },
        ]}
      />
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-bold tabular-nums md:text-3xl">{a.codigo}</h1>
        <EstadoAdicionalBadge estado={a.estado} />
        {a.motivo && <span className="w-full text-sm text-muted-foreground">Motivo: {a.motivo}</span>}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ítems</h2>
        {editable ? (
          <ItemsEditor
            guardar={accionGuardarItemsAdicional.bind(null, id, adId)}
            inicial={a.items.map((i) => ({ ...i, precioUnitario: i.precioUnitario ?? 0, descripcion: i.descripcionManual ? i.descripcion : null }))}
            moneda={a.moneda}
            bonificacion={a.mantieneBonificacion && a.presupuesto.bonifPct ? { tipo: "pct", valor: a.presupuesto.bonifPct } : null}
            incluyeIva={a.presupuesto.incluyeIva}
            ivaPct={a.presupuesto.ivaPct}
          />
        ) : a.items.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin ítems.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {a.items.map((i, n) => (
                  <tr key={n}>
                    <td className="p-3 tabular-nums">{n + 1}</td>
                    <td className="p-3">{i.descripcion}</td>
                    <td className="p-3 text-right tabular-nums">
                      {i.cantidad} {UNIDADES[i.unidad]}
                    </td>
                    {a.verMontos && <td className="p-3 text-right tabular-nums">{formatearMonto(i.precioUnitario ?? 0, a.moneda)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {a.totales && <p className="border-t p-3 text-right font-semibold tabular-nums">Subtotal {formatearMonto(a.totales.neto, a.moneda)}</p>}
          </div>
        )}
      </section>

      {editable && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Condiciones</h2>
          <CondicionesAdicional
            presupuestoId={id}
            id={adId}
            validezDias={a.validezDias}
            anticipoPct={a.anticipoPct}
            mantieneBonificacion={a.mantieneBonificacion}
            bonifPct={a.presupuesto.bonifPct}
          />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Documento</h2>
          {a.verMontos && puede("documentos", "leer") && (
            <Link href={`/presupuestos/${id}/adicionales/${adId}/documento`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileText data-icon="inline-start" /> {borrador ? "Editar textos del documento" : "Ver documento"}
            </Link>
          )}
        </div>
        {a.documento?.estado === "emitido" && a.verMontos && <Descargas documentoId={a.documento.id} pdfPendiente={a.documento.pdfEstado !== "ok"} />}
        {puede("presupuestos", "cambiar_estado") && <AccionesAdicional presupuestoId={id} id={adId} estado={a.estado} puedeEmitir={puede("documentos", "emitir")} />}
      </section>
    </>
  );
}

export default function AdicionalPage({ params }: PageProps<"/presupuestos/[id]/adicionales/[adId]">) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
