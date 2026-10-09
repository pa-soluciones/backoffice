import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { ErrorNegocio } from "@/services/errores";
import { obtenerPresupuesto, opcionesClientesObras, opcionesUsuarios } from "@/services/presupuestos";
import { requirePermiso } from "@/services/sesion";
import { ProspectoForm } from "../../_componentes/prospecto-form";

export const metadata: Metadata = { title: "Editar presupuesto" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await requirePermiso("presupuestos", "escribir");
  const { id } = await params;
  let p;
  try {
    p = await obtenerPresupuesto(id);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const [clientes, usuarios] = await Promise.all([opcionesClientesObras(), opcionesUsuarios()]);
  return (
    <>
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { href: `/presupuestos/${p.id}`, label: p.codigo ?? "Sin numerar" }, { label: "Editar" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Editar datos</h1>
      <ProspectoForm clientes={clientes} usuarios={usuarios} prospecto={{ ...p, asignados: p.asignados.map((a) => a.userId) }} />
    </>
  );
}

export default function EditarPresupuestoPage({ params }: PageProps<"/presupuestos/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
