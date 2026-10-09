import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { requirePermiso } from "@/services/sesion";
import { ClienteForm } from "../_componentes/cliente-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

async function Formulario() {
  await requirePermiso("clientes", "escribir");
  return <ClienteForm />;
}

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { label: "Nuevo" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Nuevo cliente</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}
