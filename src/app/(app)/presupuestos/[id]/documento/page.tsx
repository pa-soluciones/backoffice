import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { documentoActual, versiones } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { alcanceDe } from "@/domain/permisos";
import { claudeConfigurado } from "@/lib/claude";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { EditorDocumento } from "./editor";

export const metadata: Metadata = { title: "Documento del presupuesto" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id } = await params;
  let r;
  try {
    r = await documentoActual(id);
  } catch (e) {
    if (e instanceof ErrorNegocio) return <p className="rounded-xl border bg-card p-6 text-sm">{e.message}</p>;
    throw e;
  }
  if (!r) notFound();
  const [vs, permisos] = await Promise.all([versiones(r.doc.id), getPermisos(usuario.id)]);
  const ia = claudeConfigurado() && !!alcanceDe(permisos, "ia", "escribir");
  return (
    <>
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { href: `/presupuestos/${id}`, label: r.datos.codigo }, { label: "Documento" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Documento · {r.datos.codigo}</h1>
      <EditorDocumento
        documentoId={r.doc.id}
        presupuestoId={id}
        datos={r.datos}
        inicial={r.doc.bloques}
        defaults={r.defaults}
        editable={r.editable}
        versiones={vs.map((v) => ({ nro: v.nro, origen: v.origen, at: v.at, usuario: v.usuario }))}
        ia={ia}
      />
    </>
  );
}

export default function DocumentoPage({ params }: PageProps<"/presupuestos/[id]/documento">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
