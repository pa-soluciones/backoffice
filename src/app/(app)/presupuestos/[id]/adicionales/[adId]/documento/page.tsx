import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { claudeConfigurado } from "@/lib/claude";
import { documentoAdicional, versiones } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { EditorDocumento } from "../../../documento/editor";

export const metadata: Metadata = { title: "Documento del adicional" };

async function Contenido({ params }: { params: Promise<{ id: string; adId: string }> }) {
  const { usuario } = await requirePermiso("documentos", "leer");
  const { id, adId } = await params;
  let r;
  try {
    r = await documentoAdicional(adId);
  } catch (e) {
    if (e instanceof ErrorNegocio) return <p className="rounded-xl border bg-card p-6 text-sm">{e.message}</p>;
    throw e;
  }
  const [vs, permisos] = await Promise.all([versiones(r.doc.id), getPermisos(usuario.id)]);
  const ruta = `/presupuestos/${id}/adicionales/${adId}/documento`;
  return (
    <>
      <Migas
        items={[
          { href: "/presupuestos", label: "Seguimiento" },
          { href: `/presupuestos/${id}`, label: r.datos.presupuestoCodigo },
          { href: `/presupuestos/${id}/adicionales/${adId}`, label: r.datos.codigo },
          { label: "Documento" },
        ]}
      />
      <h1 className="text-2xl font-bold md:text-3xl">Documento · {r.datos.codigo}</h1>
      <EditorDocumento
        tipo="adicional"
        documentoId={r.doc.id}
        ruta={ruta}
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

export default function DocumentoAdicionalPage({ params }: PageProps<"/presupuestos/[id]/adicionales/[adId]/documento">) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
