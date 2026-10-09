import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { claudeConfigurado } from "@/lib/claude";
import { documentoControl, versiones } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { AlcanceControl, EmitirControl } from "../../../_componentes/control";
import { Descargas } from "../../../_componentes/descargas";
import { EditorDocumento } from "../../documento/editor";

export const metadata: Metadata = { title: "Control de perforaciones" };

const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Contenido({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id, docId } = await params;
  let r;
  try {
    r = await documentoControl(docId);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  if (r.doc.presupuestoId !== id) notFound();
  const [vs, permisos] = await Promise.all([versiones(docId), getPermisos(usuario.id)]);
  const presupuestoCodigo = r.datos.codigo.replace(/-CP\d+$/, "");
  return (
    <>
      <Migas
        items={[
          { href: "/presupuestos", label: "Seguimiento" },
          { href: `/presupuestos/${id}`, label: presupuestoCodigo },
          { href: `/presupuestos/${id}/campo`, label: "Campo" },
          { label: r.datos.codigo },
        ]}
      />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-mono text-2xl font-bold tabular-nums md:text-3xl">{r.datos.codigo}</h1>
        {r.doc.estado === "emitido" ? (
          <>
            <span className="text-sm text-muted-foreground">Emitido el {r.doc.emitidoAt ? fecha.format(r.doc.emitidoAt) : ""}</span>
            <Descargas documentoId={docId} pdfPendiente={r.doc.pdfEstado === "pendiente"} />
          </>
        ) : null}
      </header>
      {r.editable && (
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <AlcanceControl presupuestoId={id} id={docId} desde={r.doc.alcance?.desde ?? null} hasta={r.doc.alcance?.hasta ?? null} />
          {alcanceDe(permisos, "documentos", "emitir") && <EmitirControl presupuestoId={id} id={docId} />}
        </div>
      )}
      <EditorDocumento
        tipo="control"
        documentoId={docId}
        ruta={`/presupuestos/${id}/controles/${docId}`}
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

export default function ControlPage({ params }: PageProps<"/presupuestos/[id]/controles/[docId]">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
