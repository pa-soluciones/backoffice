import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { requirePermiso } from "@/services/sesion";
import { DirectorForm } from "../../explorador/_componentes/director-form";

export const metadata: Metadata = { title: "Nuevo director" };

async function Formulario() {
  await requirePermiso("clientes", "escribir");
  return <DirectorForm />;
}

export default function NuevoDirectorPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/directores", label: "Directores de obra" }, { label: "Nuevo" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Nuevo director de obra</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}
