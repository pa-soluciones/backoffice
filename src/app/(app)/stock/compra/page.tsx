import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { listarArticulos, listarProveedores, obrasEnCurso } from "@/services/stock";
import { FormCompra } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Registrar compra" };

async function Contenido() {
  const [arts, provs, obras] = await Promise.all([listarArticulos(), listarProveedores(), obrasEnCurso()]);
  return <FormCompra articulos={arts.map((a) => ({ id: a.id, nombre: a.nombre, unidad: a.unidad }))} proveedores={provs} obras={obras} />;
}

export default function CompraPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/stock", label: "Stock" }, { label: "Registrar compra" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Registrar compra</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
