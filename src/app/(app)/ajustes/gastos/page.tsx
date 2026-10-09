import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { categorias } from "@/services/gastos";
import { requirePermiso } from "@/services/sesion";
import { FilaCategoria } from "./categorias";

export const metadata: Metadata = { title: "Categorías de gasto" };

async function Lista() {
  await requirePermiso("configuracion", "escribir");
  const cats = await categorias(false);
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {cats.map((c) => (
        <li key={c.id}>
          <FilaCategoria id={c.id} nombre={c.nombre} activa={c.activa} />
        </li>
      ))}
      <li>
        <FilaCategoria id={null} nombre="" activa />
      </li>
    </ul>
  );
}

export default function CategoriasGastoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Migas items={[{ href: "/ajustes", label: "Ajustes" }, { label: "Categorías de gasto" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Categorías de gasto</h1>
      <p className="text-sm text-muted-foreground">Las inactivas no se ofrecen al cargar gastos nuevos; los gastos ya cargados las conservan.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </div>
  );
}
