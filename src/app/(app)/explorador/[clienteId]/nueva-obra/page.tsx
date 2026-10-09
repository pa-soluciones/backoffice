import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { obtenerCliente } from "@/services/clientes";
import { opcionesDirectores } from "@/services/directores";
import { requirePermiso } from "@/services/sesion";
import { ObraForm } from "../../_componentes/obra-form";

export const metadata: Metadata = { title: "Nueva obra" };

async function Contenido({ params }: { params: Promise<{ clienteId: string }> }) {
  await requirePermiso("obras", "escribir");
  const { clienteId } = await params;
  const [c, directores] = await Promise.all([obtenerCliente(clienteId), opcionesDirectores()]);
  if (!c) notFound();
  return (
    <>
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { href: `/explorador/${c.id}`, label: c.razonSocial }, { label: "Nueva obra" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Nueva obra</h1>
      <ObraForm clienteId={c.id} directores={directores} />
    </>
  );
}

export default function NuevaObraPage({ params }: PageProps<"/explorador/[clienteId]/nueva-obra">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
