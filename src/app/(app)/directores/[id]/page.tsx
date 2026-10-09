import { Folder } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { obtenerDirector } from "@/services/directores";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { accionEliminarDirector } from "../../explorador/actions";
import { BotonConfirmar } from "../../explorador/_componentes/boton-confirmar";
import { DirectorForm } from "../../explorador/_componentes/director-form";

export const metadata: Metadata = { title: "Director de obra" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("clientes", "leer");
  const { id } = await params;
  const [d, permisos] = await Promise.all([obtenerDirector(id), getPermisos(usuario.id)]);
  if (!d) notFound();
  const puedeEditar = !!alcanceDe(permisos, "clientes", "escribir");

  return (
    <>
      <Migas items={[{ href: "/directores", label: "Directores de obra" }, { label: d.nombre }]} />
      <h1 className="text-2xl font-bold md:text-3xl">{d.nombre}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Obras</h2>
        {d.obras.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin obras asignadas.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {d.obras.map((o) => (
              <li key={o.id}>
                <Link href={`/explorador/${o.clienteId}/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                  <Folder className="size-5 shrink-0 fill-primary/20 text-primary-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.direccion}</span>
                    <span className="block truncate text-sm text-muted-foreground">{o.cliente}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {puedeEditar ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Datos</h2>
          <DirectorForm director={d} />
        </section>
      ) : (
        <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
          {[
            ["Teléfono", d.telefono],
            ["Email", d.email],
            ["Empresa", d.empresa],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {alcanceDe(permisos, "clientes", "eliminar") && (
        <section className="border-t pt-6">
          <BotonConfirmar variant="destructive" accion={accionEliminarDirector.bind(null, d.id)} confirmacion={`¿Eliminar a ${d.nombre}?`}>
            Eliminar director
          </BotonConfirmar>
        </section>
      )}
    </>
  );
}

export default function DirectorPage({ params }: PageProps<"/directores/[id]">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
