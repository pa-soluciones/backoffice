import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { nombreMes } from "@/documents/reporte";
import { alcanceDe } from "@/domain/permisos";
import { claudeConfigurado } from "@/lib/claude";
import { versiones } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { documentoReporte } from "@/services/reportes";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { Descargas } from "../../../_componentes/descargas";
import { CifrasReporte, EmitirReporte } from "../../../_componentes/reporte";
import { EditorDocumento } from "../../documento/editor";

export const metadata: Metadata = { title: "Reporte mensual" };

async function Contenido({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id, docId } = await params;
  let r;
  try {
    r = await documentoReporte(docId);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const [vs, permisos] = await Promise.all([versiones(docId), getPermisos(usuario.id)]);
  const titulo = `${nombreMes(r.datos.periodo)} ${r.datos.periodo.slice(0, 4)}`;
  return (
    <>
      <Migas items={[{ href: `/presupuestos/${id}`, label: "Presupuesto" }, { href: `/presupuestos/${id}/reportes`, label: "Reportes mensuales" }, { label: titulo }]} />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-bold md:text-3xl">
          Reporte mensual · {titulo}
          <span className="block text-sm font-normal text-muted-foreground">{r.datos.direccion}</span>
        </h1>
        {r.doc.estado === "emitido" && <Descargas documentoId={docId} pdfPendiente={r.doc.pdfEstado === "pendiente"} />}
      </header>
      {r.editable && (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <CifrasReporte presupuestoId={id} id={docId} c={r.doc.reporte!} />
          {alcanceDe(permisos, "documentos", "emitir") && <EmitirReporte presupuestoId={id} id={docId} />}
        </div>
      )}
      <EditorDocumento
        tipo="reporte"
        documentoId={docId}
        ruta={`/presupuestos/${id}/reportes/${docId}`}
        datos={r.datos}
        inicial={r.doc.bloques}
        defaults={r.defaults}
        editable={r.editable}
        versiones={vs.map((v) => ({ nro: v.nro, origen: v.origen, at: v.at, usuario: v.usuario }))}
        ia={claudeConfigurado() && !!alcanceDe(permisos, "ia", "escribir")}
      />
    </>
  );
}

export default function ReportePage({ params }: PageProps<"/presupuestos/[id]/reportes/[docId]">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
