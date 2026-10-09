import { FileText, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { obtenerObra } from "@/services/obras";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Obra" };

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

async function Contenido({ params }: { params: Promise<{ clienteId: string; obraId: string }> }) {
  const { usuario } = await requirePermiso("obras", "leer");
  const { obraId } = await params;
  const [r, permisos] = await Promise.all([obtenerObra(obraId), getPermisos(usuario.id)]);
  if (!r) notFound();
  const { obra, cliente, director } = r;

  return (
    <>
      <Migas
        items={[
          { href: "/explorador", label: "Clientes" },
          { href: `/explorador/${cliente.id}`, label: cliente.razonSocial },
          { label: obra.direccion },
        ]}
      />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold md:text-3xl">{obra.direccion}</h1>
          {obra.nombre && <p className="mt-1 text-sm text-muted-foreground">{obra.nombre}</p>}
        </div>
        {alcanceDe(permisos, "obras", "escribir") === "todos" && (
          <Link href={`/explorador/${cliente.id}/${obra.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            <Pencil data-icon="inline-start" /> Editar
          </Link>
        )}
      </div>

      <dl className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Dato label="Contratista">{cliente.razonSocial}</Dato>
        <Dato label="Director de obra">
          {director ? (
            <Link href={`/directores/${director.id}`} className="text-primary-text hover:underline">
              {director.nombre}
            </Link>
          ) : (
            "—"
          )}
        </Dato>
        <Dato label="Localidad">{[obra.localidad, obra.provincia].filter(Boolean).join(", ") || "—"}</Dato>
        <Dato label="Responsable de Higiene y Seguridad">{obra.hysNombre ?? "—"}</Dato>
      </dl>
      {obra.notas && <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">{obra.notas}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Presupuestos</h2>
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay presupuestos en esta obra.</p>
        </div>
      </section>
    </>
  );
}

export default function ObraPage({ params }: PageProps<"/explorador/[clienteId]/[obraId]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
