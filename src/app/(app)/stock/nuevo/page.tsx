import type { Metadata } from "next";
import { Migas } from "@/components/migas";
import { FormArticulo } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Nuevo artículo" };

export default function NuevoArticuloPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Migas items={[{ href: "/stock", label: "Stock" }, { label: "Nuevo artículo" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Nuevo artículo</h1>
      <FormArticulo />
    </div>
  );
}
