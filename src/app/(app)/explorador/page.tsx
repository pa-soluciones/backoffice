import { Folder, HardHat, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { cn } from "@/lib/utils";
import { listarClientes } from "@/services/clientes";
import { listarPresupuestos } from "@/services/presupuestos";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Explorador" };

const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("clientes", "leer");
  const sp = await searchParams;
  const archivados = sp.archivados === "1";
  const orden = sp.orden === "actividad" ? "actividad" : "nombre";
  const [lista, permisos] = await Promise.all([listarClientes({ archivados, orden }), getPermisos(usuario.id)]);
  const anonimos = !archivados && alcanceDe(permisos, "presupuestos", "leer") ? await listarPresupuestos({ sinCliente: true }) : [];
  const qs = (c: { archivados?: boolean; orden?: string }) =>
    `?${new URLSearchParams({ ...((c.archivados ?? archivados) ? { archivados: "1" } : {}), orden: c.orden ?? orden })}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Ordenar" className="flex rounded-lg border bg-card p-1 text-sm">
          {(["nombre", "actividad"] as const).map((o) => (
            <Link
              key={o}
              href={qs({ orden: o })}
              aria-current={orden === o ? "true" : undefined}
              className={cn("rounded-md px-3 py-1.5", orden === o ? "bg-muted font-semibold" : "text-muted-foreground")}
            >
              {o === "nombre" ? "A–Z" : "Recientes"}
            </Link>
          ))}
        </div>
        <Link
          href={qs({ archivados: !archivados })}
          className="text-sm text-muted-foreground hover:underline"
        >
          {archivados ? "Ver activos" : "Ver archivados"}
        </Link>
        {alcanceDe(permisos, "clientes", "escribir") && (
          <Link href="/explorador/nuevo" className={buttonVariants({ className: "ml-auto" })}>
            <Plus data-icon="inline-start" /> Nuevo cliente
          </Link>
        )}
      </div>

      {anonimos.length > 0 && (
        <Link href="/explorador/sin-cliente" className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 hover:bg-muted/60">
          <Folder className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 font-semibold">Sin cliente</span>
          <span className="text-sm text-muted-foreground">
            {anonimos.length} {anonimos.length === 1 ? "prospecto" : "prospectos"}
          </span>
        </Link>
      )}

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Folder className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-semibold">{archivados ? "No hay clientes archivados" : "Todavía no hay clientes"}</p>
          {!archivados && <p className="mt-1 text-sm text-muted-foreground">Creá el primero para empezar a cargar sus obras.</p>}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/explorador/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                <Folder className="size-5 shrink-0 fill-primary/20 text-primary-text" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-semibold">{c.razonSocial}</span>
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  {c.obras} {c.obras === 1 ? "obra" : "obras"}
                </span>
                <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">{fecha.format(new Date(c.actividad))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ExploradorPage({ searchParams }: PageProps<"/explorador">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold md:text-3xl">Clientes</h1>
        <Link href="/directores" className="inline-flex items-center gap-1.5 text-sm text-primary-text hover:underline">
          <HardHat className="size-4" aria-hidden /> Directores de obra
        </Link>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Clientes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
