import { Folder, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { obtenerCliente } from "@/services/clientes";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Cliente" };

async function Contenido({ params }: { params: Promise<{ clienteId: string }> }) {
  const { usuario } = await requirePermiso("clientes", "leer");
  const { clienteId } = await params;
  const [c, permisos] = await Promise.all([obtenerCliente(clienteId), getPermisos(usuario.id)]);
  if (!c) notFound();
  const puedeEditar = !!alcanceDe(permisos, "clientes", "escribir");
  const puedeCrearObra = alcanceDe(permisos, "obras", "escribir") === "todos";
  const datos = [c.cuit && `CUIT ${c.cuit}`, c.telefono, c.email].filter(Boolean);

  return (
    <>
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { label: c.razonSocial }]} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold md:text-3xl">{c.razonSocial}</h1>
          {c.archivado && <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Archivado</span>}
          {datos.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{datos.join(" · ")}</p>}
        </div>
        {puedeEditar && (
          <Link href={`/explorador/${c.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            <Pencil data-icon="inline-start" /> Editar
          </Link>
        )}
      </div>
      {c.notas && <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">{c.notas}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Obras</h2>
          {puedeCrearObra && (
            <Link href={`/explorador/${c.id}/nueva-obra`} className={buttonVariants()}>
              <Plus data-icon="inline-start" /> Nueva obra
            </Link>
          )}
        </div>
        {c.obras.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Este cliente todavía no tiene obras.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {c.obras.map((o) => (
              <li key={o.id}>
                <Link href={`/explorador/${c.id}/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                  <Folder className="size-5 shrink-0 fill-primary/20 text-primary-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.direccion}</span>
                    {(o.nombre || o.director) && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {[o.nombre, o.director && `Dir.: ${o.director}`].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function ClientePage({ params }: PageProps<"/explorador/[clienteId]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
