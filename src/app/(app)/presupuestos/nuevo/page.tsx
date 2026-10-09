import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { opcionesClientesObras, opcionesUsuarios } from "@/services/presupuestos";
import { requirePermiso } from "@/services/sesion";
import { ProspectoForm } from "../_componentes/prospecto-form";

export const metadata: Metadata = { title: "Nuevo prospecto" };

async function Formulario({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermiso("presupuestos", "escribir");
  const sp = await searchParams;
  const [clientes, usuarios] = await Promise.all([opcionesClientesObras(), opcionesUsuarios()]);
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return <ProspectoForm clientes={clientes} usuarios={usuarios} inicial={{ clienteId: s("clienteId"), obraId: s("obraId") }} />;
}

export default function NuevoPresupuestoPage({ searchParams }: PageProps<"/presupuestos/nuevo">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { label: "Nuevo prospecto" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Nuevo prospecto</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
