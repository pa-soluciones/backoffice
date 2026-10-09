import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { nombreMes } from "@/documents/reporte";
import { alcanceDe } from "@/domain/permisos";
import { ErrorNegocio } from "@/services/errores";
import { obtenerPresupuesto } from "@/services/presupuestos";
import { listarReportes } from "@/services/reportes";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { NuevoReporte } from "../../_componentes/reporte";

export const metadata: Metadata = { title: "Reportes mensuales" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id } = await params;
  let p, reportes;
  try {
    [p, reportes] = await Promise.all([obtenerPresupuesto(id), listarReportes(id)]);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const puede = !!alcanceDe(await getPermisos(usuario.id), "documentos", "escribir");
  return (
    <>
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { href: `/presupuestos/${id}`, label: p.codigo ?? "Sin numerar" }, { label: "Reportes mensuales" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Reportes mensuales</h1>
      <p className="text-sm text-muted-foreground">Reporte estadístico de Higiene y Seguridad de la obra {p.obra?.direccion}, uno por mes.</p>
      {puede && p.obra && <NuevoReporte presupuestoId={id} />}
      {reportes.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Todavía no hay reportes de esta obra.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {reportes.map((r) => (
            <li key={r.id}>
              <Link href={`/presupuestos/${r.presupuestoId}/reportes/${r.id}`} className="flex min-h-12 items-center gap-3 p-3 hover:bg-muted">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 font-semibold">
                  {nombreMes(r.periodo)} {r.periodo.slice(0, 4)}
                </span>
                <span className="text-xs text-muted-foreground">{r.estado === "emitido" ? "Emitido" : "Borrador"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ReportesPage({ params }: PageProps<"/presupuestos/[id]/reportes">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
