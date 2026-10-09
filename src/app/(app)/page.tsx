import { Bell, CalendarClock, ChevronRight, FileText, HardHat, Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { ESTADOS, FINALES, type Estado } from "@/domain/workflow";
import { cn } from "@/lib/utils";
import { listarAgenda, listarJornadas } from "@/services/agenda";
import { misNotificaciones } from "@/services/notificaciones";
import { listarPresupuestos } from "@/services/presupuestos";
import { getPermisos, requireUsuario } from "@/services/sesion";

const TZ = "America/Argentina/Buenos_Aires";
const ACTIVOS = (Object.keys(ESTADOS) as Estado[]).filter((e) => !FINALES.includes(e));
const diaLargo = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const diaCorto = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", timeZone: TZ });
const hora = new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ });
const claveDia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function saludo(ahora: Date) {
  const h = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: TZ }).format(ahora));
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

async function Tablero() {
  await connection();
  const u = await requireUsuario();
  const permisos = await getPermisos(u.id);
  const verPres = !!alcanceDe(permisos, "presupuestos", "leer");
  const verAgenda = !!alcanceDe(permisos, "agenda", "leer");
  const crear = !!alcanceDe(permisos, "presupuestos", "escribir");
  const ahora = new Date();
  const hoy = claveDia.format(ahora);
  const en7 = claveDia.format(new Date(ahora.getTime() + 7 * 86_400_000));
  const [activos, recientes, visitas, jornadas, avisos] = await Promise.all([
    verPres ? listarPresupuestos({ estados: ACTIVOS }) : [],
    verPres ? listarPresupuestos({ limite: 6 }) : [],
    verAgenda ? listarAgenda(new Date(`${hoy}T00:00:00-03:00`), new Date(new Date(`${en7}T00:00:00-03:00`).getTime() + 86_400_000)) : [],
    verAgenda ? listarJornadas(hoy, en7) : [],
    misNotificaciones(true, { limite: 5 }),
  ]);
  const agenda = [
    ...visitas.filter((v) => v.estado === "agendada" && v.inicio).map((v) => ({ id: v.id, dia: claveDia.format(v.inicio!), hora: hora.format(v.inicio!), titulo: `Visita técnica · ${v.cliente}`, detalle: v.direccion, href: `/presupuestos/${v.presupuestoId}`, icono: CalendarClock })),
    ...jornadas.map((j) => ({ id: j.id, dia: j.fecha, hora: "", titulo: `Jornada · ${j.codigo ?? ""} ${j.cliente}`, detalle: j.operarios.join(", "), href: `/presupuestos/${j.presupuestoId}?tab=obra`, icono: HardHat })),
  ].sort((a, b) => (a.dia + a.hora).localeCompare(b.dia + b.hora));
  const enCurso = activos.filter((p) => p.estado === "en_progreso");
  const montoEnCurso = enCurso.reduce((s, p) => s + (p.moneda === "ARS" ? (p.total ?? 0) : 0), 0);

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {saludo(ahora)}, {u.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">{capital(diaLargo.format(ahora))}</p>
        </div>
        {crear && (
          <Link href="/presupuestos/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Nuevo prospecto
          </Link>
        )}
      </header>

      {avisos.length > 0 && (
        <section aria-labelledby="atender" className="rounded-xl border border-primary/60 bg-accent p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="atender" className="flex items-center gap-2 font-semibold">
              <Bell className="size-4 text-primary-text" aria-hidden /> Para atender
            </h2>
            <Link href="/notificaciones" className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
              Ver todo
            </Link>
          </div>
          <ul className="space-y-1">
            {avisos.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/notificaciones"} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-card">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{n.titulo}</span>
                    {n.cuerpo && <span className="block truncate text-muted-foreground">{n.cuerpo}</span>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {verPres && (
        <section aria-labelledby="embudo" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="embudo" className="text-lg font-semibold">
              Presupuestos activos
            </h2>
            {montoEnCurso > 0 && <p className="text-sm text-muted-foreground">En obra: {formatearMonto(montoEnCurso)}</p>}
          </div>
          <ol className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-5 sm:divide-x">
            {ACTIVOS.map((e) => {
              const n = activos.filter((p) => p.estado === e).length;
              return (
                <li key={e} className="border-b sm:border-b-0">
                  <Link href={`/presupuestos?vista=lista&estado=${e}`} className={cn("flex h-full flex-col gap-1 p-4 hover:bg-muted/60", n === 0 && "text-muted-foreground")}>
                    <span className="text-sm">{ESTADOS[e]}</span>
                    <span className={cn("text-2xl font-bold tabular-nums", n > 0 && "text-foreground")}>{n}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {verAgenda && (
          <section aria-labelledby="agenda" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="agenda" className="text-lg font-semibold">
                Próximos 7 días
              </h2>
              <Link href="/agenda" className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
                Agenda
              </Link>
            </div>
            {agenda.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin visitas ni jornadas planificadas.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {agenda.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center gap-3 p-3 hover:bg-muted/60">
                      <span className={cn("w-16 shrink-0 text-center text-xs font-semibold capitalize", a.dia === hoy ? "text-primary-text" : "text-muted-foreground")}>
                        {a.dia === hoy ? "Hoy" : diaCorto.format(new Date(`${a.dia}T12:00:00-03:00`))}
                        {a.hora && <span className="block text-sm text-foreground tabular-nums">{a.hora}</span>}
                      </span>
                      <a.icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.titulo}</span>
                        {a.detalle && <span className="block truncate text-xs text-muted-foreground">{a.detalle}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {verPres && (
          <section aria-labelledby="recientes" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="recientes" className="text-lg font-semibold">
                Movidos recientemente
              </h2>
              <Link href="/presupuestos?vista=lista" className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
                Todos
              </Link>
            </div>
            {recientes.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
                <FileText className="size-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold">Todavía no hay presupuestos</p>
                {crear && (
                  <Link href="/presupuestos/nuevo" className="mt-2 text-sm font-semibold text-primary-text hover:underline">
                    Cargar el primer prospecto
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {recientes.map((p) => (
                  <li key={p.id}>
                    <Link href={`/presupuestos/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/60">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold tabular-nums">{p.codigo ?? "Sin numerar"}</span>
                        <span className="block truncate text-sm text-muted-foreground">{p.cliente}</span>
                      </span>
                      <EstadoBadge estado={p.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Tablero />
      </Suspense>
    </div>
  );
}
