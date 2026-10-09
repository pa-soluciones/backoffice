import { FileText, HardHat, ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { alturaPiso, ESTADOS_REGISTRO } from "@/domain/balance";
import { alcanceDe } from "@/domain/permisos";
import { balancePresupuesto, contextoCarga, listarRegistros, urlsFotos } from "@/services/campo";
import { listarControles } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { obtenerPresupuesto } from "@/services/presupuestos";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { BotonCrearAdicional } from "../../_componentes/adicional";
import { BotonNuevoControl } from "../../_componentes/control";
import { TablaBalance } from "../../_componentes/balance";
import { RegistroAcciones } from "../../_componentes/registro-acciones";

export const metadata: Metadata = { title: "Campo del presupuesto" };

const TZ = "America/Argentina/Buenos_Aires";
const fechaCorta = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: TZ });
const fechaDia = (iso: string) => fechaCorta.format(new Date(`${iso}T12:00:00-03:00`));
const AGRUPAR = { piso: "Por piso", fecha: "Por fecha", diametro: "Por diámetro" } as const;
type Agrupar = keyof typeof AGRUPAR;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("campo", "leer");
  const { id } = await params;
  const sp = await searchParams;
  const agrupar: Agrupar = typeof sp.agrupar === "string" && sp.agrupar in AGRUPAR ? (sp.agrupar as Agrupar) : "piso";
  let p, registros, b;
  try {
    p = await obtenerPresupuesto(id);
    [registros, b] = await Promise.all([listarRegistros(id), balancePresupuesto(id)]);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const permisos = await getPermisos(usuario.id);
  const puedeCargar = !!alcanceDe(permisos, "campo", "escribir");
  const enCurso = ["en_progreso", "pendiente_liquidacion"].includes(p.estado);
  const ctx = puedeCargar ? await contextoCarga(id).catch(() => null) : null;
  const puedeDocs = !!alcanceDe(permisos, "documentos", "leer");
  const controles = puedeDocs ? await listarControles(id) : [];
  const urls = await urlsFotos(id, registros.flatMap((r) => r.fotos.map((f) => f.id)));
  const excedentes = b.filas.filter((f) => f.diferencia > 0);
  const codigo = p.codigo ?? "Sin numerar";

  const ordenados = [...registros].sort((a, c) =>
    agrupar === "piso" ? alturaPiso(c.piso) - alturaPiso(a.piso) : agrupar === "diametro" ? (a.diametroMm ?? 0) - (c.diametroMm ?? 0) : c.fecha.localeCompare(a.fecha),
  );
  const grupos = Map.groupBy(ordenados, (r) => (agrupar === "piso" ? `Piso ${r.piso}` : agrupar === "diametro" ? `Ø ${r.diametroMm} mm` : fechaDia(r.fecha)));

  return (
    <>
      <Migas items={[{ href: "/presupuestos", label: "Seguimiento" }, { href: `/presupuestos/${id}`, label: codigo }, { label: "Campo" }]} />
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold md:text-3xl">Campo · {codigo}</h1>
        {puedeCargar && enCurso && (
          <Link href={`/campo/${id}`} className={buttonVariants()}>
            <HardHat data-icon="inline-start" /> Registrar
          </Link>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Balance</h2>
        <TablaBalance filas={b.filas} totales={b.totales} verMontos={b.verMontos} moneda={p.moneda} />
        {excedentes.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-primary bg-primary/10 p-3 text-sm">
            <span className="min-w-0 flex-1">
              {excedentes.map((f) => `${f.diferencia} perforaciones Ø${f.diametroMm} sin cotizar`).join(" · ")}. Cubrilas con un trabajo adicional.
            </span>
            {p.estado === "en_progreso" && alcanceDe(permisos, "presupuestos", "escribir") && <BotonCrearAdicional presupuestoId={id} />}
          </div>
        )}
      </section>

      {puedeDocs && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-semibold">Controles de perforaciones</h2>
            {["en_progreso", "pendiente_liquidacion", "terminado"].includes(p.estado) && alcanceDe(permisos, "documentos", "escribir") && <BotonNuevoControl presupuestoId={id} />}
          </div>
          {controles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se emitió ningún control.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {controles.map((c) => (
                <li key={c.id}>
                  <Link href={`/presupuestos/${id}/controles/${c.id}`} className="flex min-h-12 items-center gap-3 p-3 hover:bg-muted">
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 font-mono font-semibold">
                      {codigo}-CP{c.nro}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.estado === "emitido" && c.emitidoAt ? `Emitido ${fechaCorta.format(c.emitidoAt)}` : "Borrador"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold">Registros ({registros.length})</h2>
          <nav aria-label="Agrupar registros" className="flex gap-1">
            {Object.entries(AGRUPAR).map(([k, v]) => (
              <Link key={k} href={`?agrupar=${k}`} aria-current={k === agrupar ? "page" : undefined} className={buttonVariants({ variant: k === agrupar ? "secondary" : "ghost", size: "sm" })}>
                {v}
              </Link>
            ))}
          </nav>
        </div>
        {registros.length === 0 && <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Todavía no hay registros de campo.</p>}
        {[...grupos].map(([titulo, rs]) => (
          <div key={titulo} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{titulo}</h3>
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {rs.map((r) => {
                const etiqueta = `Piso ${r.piso} · ${r.elemento} · Ø${r.diametroMm} × ${r.cantidad}`;
                const operarios = r.operarios.map((o) => o.name).join(", ");
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[r.espesorCm ? `${r.espesorCm} cm` : null, ESTADOS_REGISTRO[r.estado], r.observacion, fechaDia(r.fecha), operarios].filter(Boolean).join(" · ")}
                      </span>
                      {r.fotos.length === 0 ? (
                        <span className="mt-1 flex items-center gap-1 text-xs text-primary-text">
                          <ImageOff className="size-3.5" aria-hidden /> Sin evidencia fotográfica
                        </span>
                      ) : (
                        <span className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {r.fotos.map((f) =>
                            urls[f.id] ? (
                              <figure key={f.id} className="space-y-1">
                                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2 */}
                                <img src={urls[f.id]} alt={`Foto: ${etiqueta}`} loading="lazy" className="aspect-square w-full rounded-lg border object-cover" />
                                <figcaption className="text-[11px] leading-tight text-muted-foreground">
                                  Piso {r.piso} · {r.elemento} · Ø{r.diametroMm} · {fechaCorta.format(f.tomadaAt)} · {operarios}
                                </figcaption>
                              </figure>
                            ) : null,
                          )}
                        </span>
                      )}
                    </span>
                    {puedeCargar && (
                      <RegistroAcciones
                        presupuestoId={id}
                        codigo={codigo}
                        registroId={r.id}
                        etiqueta={etiqueta}
                        ctx={ctx}
                        inicial={{ ...r, operarios: r.operarios.map((o) => o.id) }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

export default function CampoPresupuestoPage({ params, searchParams }: PageProps<"/presupuestos/[id]/campo">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
