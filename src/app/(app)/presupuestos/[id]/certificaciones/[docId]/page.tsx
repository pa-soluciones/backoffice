import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { claudeConfigurado } from "@/lib/claude";
import { documentoCertificacion } from "@/services/certificaciones";
import { versiones } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { EmitirCertificacion, ParametrosCertificacion } from "../../../_componentes/certificacion";
import { Descargas } from "../../../_componentes/descargas";
import { EditorDocumento } from "../../documento/editor";

export const metadata: Metadata = { title: "Certificación" };

const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Contenido({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id, docId } = await params;
  let r;
  try {
    r = await documentoCertificacion(docId);
  } catch (e) {
    if (e instanceof ErrorNegocio) return <p className="rounded-xl border bg-card p-6 text-sm">{e.message}</p>;
    throw e;
  }
  if (r.doc.presupuestoId !== id) notFound();
  const [vs, permisos] = await Promise.all([versiones(docId), getPermisos(usuario.id)]);
  return (
    <>
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { href: `/presupuestos/${id}`, label: r.datos.presupuestoCodigo }, { label: r.datos.codigo }]} />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-mono text-2xl font-bold tabular-nums md:text-3xl">{r.datos.codigo}</h1>
        {r.doc.estado === "emitido" && (
          <>
            <span className="text-sm text-muted-foreground">
              {r.parametros.tipo === "final" ? "Final" : "Parcial"} · Emitida el {r.doc.emitidoAt ? fecha.format(r.doc.emitidoAt) : ""}
            </span>
            <Descargas documentoId={docId} pdfPendiente={r.doc.pdfEstado === "pendiente"} />
          </>
        )}
      </header>
      {r.editable && (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <ParametrosCertificacion
            presupuestoId={id}
            id={docId}
            tipo={r.parametros.tipo}
            items={r.items}
            adicionales={r.adicionalesAprobados}
            incluidos={r.parametros.adicionales}
          />
          {alcanceDe(permisos, "documentos", "emitir") && <EmitirCertificacion presupuestoId={id} id={docId} />}
        </div>
      )}
      <EditorDocumento
        tipo="certificacion"
        documentoId={docId}
        ruta={`/presupuestos/${id}/certificaciones/${docId}`}
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

export default function CertificacionPage({ params }: PageProps<"/presupuestos/[id]/certificaciones/[docId]">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
