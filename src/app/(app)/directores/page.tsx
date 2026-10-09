import { HardHat, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { listarDirectores } from "@/services/directores";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Directores de obra" };

async function Lista() {
  const { usuario } = await requirePermiso("clientes", "leer");
  const [lista, permisos] = await Promise.all([listarDirectores(), getPermisos(usuario.id)]);
  return (
    <>
      {alcanceDe(permisos, "clientes", "escribir") && (
        <div className="flex justify-end">
          <Link href="/directores/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Nuevo director
          </Link>
        </div>
      )}
      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <HardHat className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-semibold">Todavía no hay directores de obra</p>
          <p className="mt-1 text-sm text-muted-foreground">También se pueden crear desde el formulario de una obra.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {lista.map((d) => (
            <li key={d.id}>
              <Link href={`/directores/${d.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.nombre}</span>
                  {d.empresa && <span className="block truncate text-sm text-muted-foreground">{d.empresa}</span>}
                </span>
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  {d.obras} {d.obras === 1 ? "obra" : "obras"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function DirectoresPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { label: "Directores de obra" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Directores de obra</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </div>
  );
}
