import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { listarAgenda, listarJornadas } from "@/services/agenda";

export const metadata: Metadata = { title: "Agenda" };

const TZ = "America/Argentina/Buenos_Aires";
const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const hora = new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ });
const claveDia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** Lunes 00:00 (hora Argentina) de la semana que contiene `fecha` (yyyy-mm-dd). */
function lunesDe(fecha: string) {
  const d = new Date(`${fecha}T00:00:00-03:00`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes (ART = UTC-3, a las 00 ART ya es el mismo día UTC)
  return new Date(d.getTime() - dow * 86_400_000);
}

async function Semana({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await connection(); // "hoy" depende del momento del pedido, no del build
  const base = typeof sp.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : claveDia.format(new Date());
  const desde = lunesDe(base);
  const hasta = new Date(desde.getTime() + 7 * 86_400_000);
  const [visitas, jornadas] = await Promise.all([listarAgenda(desde, hasta), listarJornadas(claveDia.format(desde), claveDia.format(new Date(hasta.getTime() - 1)))]);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(desde.getTime() + i * 86_400_000));
  const link = (dias: number) => `?semana=${claveDia.format(new Date(desde.getTime() + dias * 86_400_000))}`;
  const hoy = claveDia.format(new Date());

  return (
    <>
      <nav aria-label="Semanas" className="flex items-center gap-2">
        <Link href={link(-7)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Semana anterior">
          <ChevronLeft />
        </Link>
        <Link href="/agenda" className={buttonVariants({ variant: "outline" })}>
          Hoy
        </Link>
        <Link href={link(7)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Semana siguiente">
          <ChevronRight />
        </Link>
        <span className="ml-2 text-sm text-muted-foreground">
          {dia.format(dias[0])} — {dia.format(dias[6])}
        </span>
      </nav>

      <ol className="space-y-3">
        {dias.map((d) => {
          const k = claveDia.format(d);
          const delDia = visitas.filter((v) => v.inicio && claveDia.format(v.inicio) === k);
          const jornadasDelDia = jornadas.filter((j) => j.fecha === k);
          return (
            <li key={k} className="rounded-xl border bg-card">
              <h2 className={`border-b px-4 py-2 text-sm font-semibold capitalize ${k === hoy ? "text-primary-text" : ""}`}>
                {dia.format(d)}
                {k === hoy && " · hoy"}
              </h2>
              {jornadasDelDia.length > 0 && (
                <ul className="divide-y border-b">
                  {jornadasDelDia.map((j) => (
                    <li key={j.id}>
                      <Link href={`/presupuestos/${j.presupuestoId}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/60">
                        <span className="w-12 text-xs font-semibold text-muted-foreground">Día</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            Jornada de trabajo · {j.codigo ?? "sin numerar"} · {j.cliente}
                          </span>
                          {j.direccion && <span className="block text-sm text-muted-foreground">{j.direccion}</span>}
                          <span className="block text-sm text-muted-foreground">{[j.operarios.join(", "), j.notas].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {delDia.length === 0 ? (
                jornadasDelDia.length ? null : <p className="px-4 py-3 text-sm text-muted-foreground">Sin visitas ni jornadas.</p>
              ) : (
                <ul className="divide-y">
                  {delDia.map((v) => (
                    <li key={v.id}>
                      <Link href={`/presupuestos/${v.presupuestoId}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/60">
                        <span className="w-12 font-semibold tabular-nums">{v.inicio ? hora.format(v.inicio) : ""}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            Visita técnica · {v.codigo ?? "sin numerar"} · {v.cliente}
                          </span>
                          {v.direccion && <span className="block text-sm text-muted-foreground">{v.direccion}</span>}
                          {v.responsables.length > 0 && <span className="block text-sm text-muted-foreground">{v.responsables.join(", ")}</span>}
                        </span>
                        {v.estado === "realizada" && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Realizada</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
        <CalendarDays className="size-7 text-primary-text" aria-hidden /> Agenda
      </h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Semana searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
