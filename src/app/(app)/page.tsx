import { CalendarClock, FileText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import { alcanceDe } from "@/domain/permisos";
import { ESTADOS, type Estado } from "@/domain/workflow";
import { listarAgenda } from "@/services/agenda";
import { listarPresupuestos } from "@/services/presupuestos";
import { getPermisos, requireUsuario } from "@/services/sesion";

const KPIS: Estado[] = ["prospecto", "en_espera", "en_progreso", "pendiente_liquidacion"];
const fechaHora = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

async function Tablero() {
  const u = await requireUsuario();
  const permisos = await getPermisos(u.id);
  const verPres = !!alcanceDe(permisos, "presupuestos", "leer");
  const verAgenda = !!alcanceDe(permisos, "agenda", "leer");
  const ahora = new Date();
  const [lista, visitas] = await Promise.all([
    verPres ? listarPresupuestos() : [],
    verAgenda ? listarAgenda(ahora, new Date(ahora.getTime() + 7 * 86_400_000)) : [],
  ]);
  const proximas = visitas.filter((v) => v.estado === "agendada");

  return (
    <>
      {verPres && (
        <section aria-label="Presupuestos por estado" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPIS.map((e) => (
            <Link key={e} href={`/presupuestos?vista=lista&estado=${e}`} className="rounded-xl border bg-card p-4 hover:border-ring">
              <p className="text-sm text-muted-foreground">{ESTADOS[e]}</p>
              <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{lista.filter((p) => p.estado === e).length}</p>
            </Link>
          ))}
        </section>
      )}

      {verAgenda && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Visitas de los próximos 7 días</h2>
          {proximas.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No hay visitas agendadas.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {proximas.map((v) => (
                <li key={v.id}>
                  <Link href={`/presupuestos/${v.presupuestoId}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                    <CalendarClock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="w-28 text-sm font-semibold capitalize tabular-nums">{v.inicio && fechaHora.format(v.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {v.cliente}
                      {v.direccion && <span className="text-muted-foreground"> · {v.direccion}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {verPres && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Movimiento reciente</h2>
          {lista.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
              <FileText className="size-10 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-semibold">Todavía no hay presupuestos</p>
              <Link href="/presupuestos/nuevo" className="mt-2 text-sm text-primary-text hover:underline">
                Cargar el primer prospecto
              </Link>
            </div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {lista.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/presupuestos/${p.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
                    <span className="w-24 font-mono text-sm font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
                    <span className="min-w-0 flex-1 truncate">{p.cliente}</span>
                    <EstadoBadge estado={p.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Inicio</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Tablero />
      </Suspense>
    </div>
  );
}
