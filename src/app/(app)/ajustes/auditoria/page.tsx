import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listarAuditoria, type FiltroAuditoria } from "@/services/auditoria";

export const metadata: Metadata = { title: "Auditoría" };

const fecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ORIGEN: Record<string, string> = { ui: "App", mcp: "MCP", cron: "Automático", system: "Sistema" };

async function Tabla({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const filtro: FiltroAuditoria = {
    accion: s("accion"),
    entidad: s("entidad"),
    desde: s("desde"),
    hasta: s("hasta"),
    pagina: Number(s("pagina") ?? 1) || 1,
  };
  const { filas, hayMas, pagina } = await listarAuditoria(filtro);
  const link = (p: number) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(filtro).filter(([, v]) => v)) as Record<string, string>), pagina: String(p) })}`;

  return (
    <>
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="accion">Acción</Label>
          <Input id="accion" name="accion" defaultValue={filtro.accion} placeholder="ej. usuario.crear" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entidad">Entidad</Label>
          <Input id="entidad" name="entidad" defaultValue={filtro.entidad} placeholder="ej. 2026/0105" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={filtro.desde} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={filtro.hasta} />
        </div>
        <Button type="submit" size="lg">
          Filtrar
        </Button>
      </form>

      {filas.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">Sin registros para este filtro.</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {filas.map((f) => (
            <li key={f.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-mono text-sm font-semibold">{f.action}</code>
                {f.entityLabel && <span className="text-sm">{f.entityLabel}</span>}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fecha.format(f.at)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {f.actor ?? "—"} · {ORIGEN[f.source] ?? f.source}
                {f.ip ? ` · ${f.ip}` : ""}
              </p>
              {f.diff != null && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary-text">Ver detalle</summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(f.diff, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}

      <nav aria-label="Paginación" className="flex justify-between">
        {pagina > 1 ? (
          <Link href={link(pagina - 1)} className={buttonVariants({ variant: "outline" })}>
            Más recientes
          </Link>
        ) : (
          <span />
        )}
        {hayMas && (
          <Link href={link(pagina + 1)} className={buttonVariants({ variant: "outline" })}>
            Más antiguos
          </Link>
        )}
      </nav>
    </>
  );
}

export default function AuditoriaPage({ searchParams }: PageProps<"/ajustes/auditoria">) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/ajustes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Ajustes
        </Link>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Auditoría</h1>
        <p className="text-sm text-muted-foreground">Registro de solo lectura: no se puede editar ni borrar.</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Tabla searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
