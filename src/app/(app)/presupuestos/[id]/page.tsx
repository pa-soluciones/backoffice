import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, FilePlus2, FileSpreadsheet, FileText, HardHat, Info, Pencil, Ruler, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BonificadoBadge, EstadoAdicionalBadge, EstadoBadge } from "@/components/estado-badge";
import { Migas } from "@/components/migas";
import { Plegable } from "@/components/plegable";
import { buttonVariants } from "@/components/ui/button";
import { UNIDADES } from "@/domain/items";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { siguientePaso, type Paso } from "@/domain/siguiente-paso";
import { destinos, ESTADOS, esFinal, type Estado } from "@/domain/workflow";
import { cn } from "@/lib/utils";
import { listarAdicionales } from "@/services/adicionales";
import { listarJornadas, responsablesDeVisitas } from "@/services/agenda";
import { listarAnexos } from "@/services/anexos";
import { balancePresupuesto } from "@/services/campo";
import { listarCertificaciones } from "@/services/certificaciones";
import { listarCobros } from "@/services/cobros";
import { carpetaDocumentos, documentosEmitidos } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { resumenPresupuesto } from "@/services/finanzas";
import { categorias as categoriasGasto, listarGastos } from "@/services/gastos";
import { obtenerPresupuesto, opcionesUsuarios } from "@/services/presupuestos";
import { esAdmin, getPermisos, requirePermiso } from "@/services/sesion";
import { disponiblesEnDeposito, materialesDelPresupuesto } from "@/services/stock";
import { FormGasto } from "../../campo/_componentes/form-gasto";
import { accionGuardarItems } from "../actions";
import { AccionesEstado, Reabrir } from "../_componentes/acciones-estado";
import { BotonCrearAdicional } from "../_componentes/adicional";
import { Anexos } from "../_componentes/anexos";
import { TablaBalance } from "../_componentes/balance";
import { BotonNuevaCertificacion } from "../_componentes/certificacion";
import { Cobros } from "../_componentes/cobros";
import { ComercialesForm } from "../_componentes/comerciales-form";
import { Descargas } from "../_componentes/descargas";
import { ListaGastos } from "../_componentes/gastos";
import { ItemsEditor } from "../_componentes/items-editor";
import { Jornadas } from "../_componentes/jornadas";
import { Materiales } from "../_componentes/materiales";
import { ResumenEconomico } from "../_componentes/resumen";
import { BotonesRevision } from "../_componentes/revisiones";
import { AgendarVisita, ResolverVisita } from "../_componentes/visitas";

export const metadata: Metadata = { title: "Presupuesto" };

const TZ = "America/Argentina/Buenos_Aires";
const fechaHora = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: TZ });
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const ESTADO_VISITA = { pendiente: "Sin fecha", agendada: "Agendada", realizada: "Realizada", omitida: "Omitida", cancelada: "Cancelada" } as const;
const EN_CURSO = ["en_progreso", "pendiente_liquidacion", "terminado"];
const PESTANAS = { presupuesto: "Presupuesto", documentos: "Documentos", obra: "Obra", dinero: "Cobros y gastos", archivos: "Archivos", historial: "Historial" } as const;
type Pestana = keyof typeof PESTANAS;
const ICONO_DOC = { presupuesto: FileText, adicional: FilePlus2, certificacion: ClipboardCheck, control: Ruler, reporte: FileSpreadsheet } as const;

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

const Vacio = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{children}</p>;

const TONO: Record<Paso["tono"], { clase: string; icono: typeof Info }> = {
  accion: { clase: "border-primary bg-accent", icono: Sparkles },
  alerta: { clase: "border-warning/50 bg-warning/10", icono: AlertTriangle },
  info: { clase: "border-border bg-muted/60", icono: Info },
  ok: { clase: "border-success/40 bg-success/10", icono: CheckCircle2 },
};

/** Lo más importante de este momento del presupuesto, arriba y bien visible. */
function ProximoPaso({ paso, href }: { paso: Paso; href?: string }) {
  const { clase, icono: Icono } = TONO[paso.tono];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", clase)} role={paso.tono === "alerta" ? "alert" : "status"}>
      <Icono className={cn("mt-0.5 size-4 shrink-0", paso.tono === "alerta" ? "text-warning" : paso.tono === "ok" ? "text-success" : "text-primary-text")} aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">Próximo paso</span>
        <span className="font-medium">{paso.texto}</span>
      </p>
      {href && (
        <Link href={href} className="shrink-0 self-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
          Ir
        </Link>
      )}
    </div>
  );
}

function Dato({ k, v, fuerte, children }: { k: string; v?: React.ReactNode; fuerte?: boolean; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={cn("tabular-nums", fuerte ? "text-lg font-semibold" : "font-medium")}>{v}</dd>
      {children}
    </div>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await requirePermiso("presupuestos", "leer");
  const { id } = await params;
  const sp = await searchParams;
  let p;
  try {
    p = await obtenerPresupuesto(id);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const permisos = await getPermisos(usuario.id);
  const puede = (m: Parameters<typeof alcanceDe>[1], a: Parameters<typeof alcanceDe>[2]) => !!alcanceDe(permisos, m, a);
  const enCurso = EN_CURSO.includes(p.estado);
  const [admin, usuarios, responsables, docs, adicionales, anexos, balance, cobros, certificaciones, materiales, disponibles, gastos, cats, resumen, jornadas, carpeta] = await Promise.all([
    esAdmin(usuario.id),
    opcionesUsuarios(),
    responsablesDeVisitas(p.visitas.map((v) => v.id)),
    documentosEmitidos(id),
    listarAdicionales(id),
    puede("anexos", "leer") ? listarAnexos(id) : null,
    puede("campo", "leer") && enCurso ? balancePresupuesto(id) : null,
    puede("cobros", "leer") && p.verMontos ? listarCobros(id) : null,
    puede("documentos", "leer") && p.verMontos && enCurso ? listarCertificaciones(id) : null,
    puede("stock", "leer") && enCurso ? materialesDelPresupuesto(id) : null,
    puede("stock", "escribir") && p.estado === "en_progreso" ? disponiblesEnDeposito() : [],
    puede("gastos", "leer") && p.verMontos && enCurso ? listarGastos({ presupuestoId: id }) : null,
    categoriasGasto(),
    p.verMontos && enCurso ? resumenPresupuesto(id) : null,
    puede("agenda", "leer") && enCurso ? listarJornadas("2000-01-01", "2999-12-31", id) : null,
    puede("documentos", "leer") ? carpetaDocumentos(id) : null,
  ]);

  const cerrado = esFinal(p.estado);
  const borrador = p.revisionActual?.estado === "borrador";
  const editableItems = !cerrado && borrador && p.verMontos && puede("presupuestos", "escribir");
  const ultimaEmitida = p.revisiones.find((r) => r.estado === "emitida");
  const vence = ultimaEmitida?.emitidaAt ? new Date(ultimaEmitida.emitidaAt.getTime() + p.validezDias * 86_400_000) : null;
  const vencida = p.estado === "en_espera" && !!vence && vence < new Date();
  const verDocumento = p.verMontos && puede("documentos", "leer");
  const total = p.totales?.total ?? p.revisiones.find((r) => r.total != null)?.total ?? null;
  const excedente = balance ? balance.filas.reduce((s, f) => s + Math.max(0, f.diferencia), 0) : 0;
  const anticipo = cobros?.esperados.find((e) => e.concepto === "anticipo" && !e.adicionalId);
  const avance = balance && balance.totales.cotizadas > 0 ? Math.min(100, Math.round((balance.totales.ejecutadas / balance.totales.cotizadas) * 100)) : null;

  const paso = siguientePaso({
    estado: p.estado,
    tieneItems: p.items.length > 0,
    borrador,
    requiereVisita: p.requiereVisita,
    visitaResuelta: p.visitas.some((v) => ["realizada", "omitida"].includes(v.estado)),
    visitaAgendada: p.visitas.some((v) => v.estado === "agendada"),
    ofertaVencida: vencida,
    excedente,
    anticipoPendiente: !!anticipo && anticipo.estado !== "abonado",
    porCobrar: cobros?.porCobrar ?? 0,
    materialesEnObra: materiales?.enObra.length ?? 0,
  });

  // Pestañas visibles según el momento del presupuesto y los permisos.
  const visibles = (Object.keys(PESTANAS) as Pestana[]).filter(
    (t) => t === "presupuesto" || t === "historial" || (t === "documentos" && carpeta) || (t === "obra" && enCurso && (balance || materiales || jornadas)) || (t === "dinero" && enCurso && (cobros || gastos || resumen)) || (t === "archivos" && anexos),
  );
  const pedida = typeof sp.tab === "string" && (visibles as string[]).includes(sp.tab) ? (sp.tab as Pestana) : "presupuesto";
  const marca: Partial<Record<Pestana, { texto: string; alerta?: boolean }>> = {
    obra: excedente > 0 ? { texto: `+${excedente}`, alerta: true } : avance != null ? { texto: `${avance}%` } : undefined,
    dinero: cobros && cobros.porCobrar > 0 ? { texto: "por cobrar", alerta: p.estado === "pendiente_liquidacion" } : undefined,
    documentos: carpeta?.length ? { texto: String(carpeta.length) } : undefined,
    archivos: anexos?.length ? { texto: String(anexos.length) } : undefined,
  };

  return (
    <>
      <Migas
        items={[
          { href: "/presupuestos", label: "Seguimiento" },
          ...(p.cliente ? [{ href: `/explorador/${p.cliente.id}`, label: p.cliente.razonSocial }] : []),
          ...(p.obra && p.cliente ? [{ href: `/explorador/${p.cliente.id}/${p.obra.id}`, label: p.obra.direccion }] : []),
          { label: p.codigo ?? "Sin numerar" },
        ]}
      />

      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tabular-nums md:text-3xl">{p.codigo ?? "Sin numerar"}</h1>
            <EstadoBadge estado={p.estado} className="text-sm" />
            {p.bonificacion && <BonificadoBadge />}
            {vencida && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Oferta vencida</span>}
          </div>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{p.cliente?.razonSocial ?? `Prospecto sin cliente${p.contactoNombre ? `: ${p.contactoNombre}` : ""}`}</span>
            {p.obra && ` · ${p.obra.direccion}`}
            {p.director && ` · Dir.: ${p.director}`}
          </p>
        </div>
        {puede("presupuestos", "escribir") && !cerrado && (
          <Link href={`/presupuestos/${p.id}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil data-icon="inline-start" /> Editar datos
          </Link>
        )}
      </header>

      {/* Mobile: próximo paso y datos → contenido → cambio de estado. Desktop: panel lateral. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <aside className="space-y-4 max-lg:order-1 lg:col-start-2 lg:row-start-1" aria-label="Resumen del presupuesto">
          {paso && <ProximoPaso paso={paso} href={paso.pestana && paso.pestana !== pedida ? `?tab=${paso.pestana}` : undefined} />}

          <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4">
            {p.verMontos && <Dato k="Total" v={total != null ? formatearMonto(total, p.moneda) : "—"} fuerte />}
            {cobros && enCurso && <Dato k="Por cobrar" v={formatearMonto(cobros.porCobrar, p.moneda)} fuerte />}
            {cobros && enCurso && <Dato k="Cobrado" v={formatearMonto(cobros.cobrado, p.moneda)} />}
            {avance != null && (
              <Dato k="Avance de obra" v={`${balance!.totales.ejecutadas} de ${balance!.totales.cotizadas} perf.`}>
                <span className="block h-1.5 rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${avance}%` }} />
                </span>
              </Dato>
            )}
            {vence && p.estado === "en_espera" && <Dato k="Oferta válida hasta" v={fecha.format(vence)} />}
            {p.fechaConfirmacion && <Dato k="Confirmado" v={fecha.format(new Date(`${p.fechaConfirmacion}T12:00:00-03:00`))} />}
            <div className="col-span-2 space-y-1">
              <dt className="text-xs text-muted-foreground">Asignados</dt>
              <dd className="text-sm">{p.asignados.length ? p.asignados.map((a) => a.name).join(", ") : "Nadie todavía"}</dd>
            </div>
            {(p.contactoTelefono || p.contactoEmail || p.origen) && (
              <div className="col-span-2 space-y-1">
                <dt className="text-xs text-muted-foreground">Contacto</dt>
                <dd className="text-sm break-words">{[p.contactoTelefono, p.contactoEmail, p.origen && `Origen: ${p.origen}`].filter(Boolean).join(" · ")}</dd>
              </div>
            )}
          </dl>
        </aside>

        {puede("presupuestos", "cambiar_estado") && (
          <section aria-label="Estado" className="rounded-xl border bg-card p-4 max-lg:order-3 lg:col-start-2 lg:row-start-2">
              {cerrado ? (
                <div className="space-y-3 text-sm">
                  <p>
                    Cerrado como <strong>{ESTADOS[p.estado]}</strong>
                    {p.motivoCierre ? `: ${p.motivoCierre}` : ""}.
                  </p>
                  {admin && <Reabrir id={p.id} />}
                </div>
              ) : (
                <AccionesEstado id={p.id} destinos={destinos(p.estado)} hoy={hoyAR()} />
              )}
          </section>
        )}

        <div className="min-w-0 space-y-6 max-lg:order-2 lg:col-start-1 lg:row-span-3 lg:row-start-1">
          {p.pedido && (
            <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Pedido del cliente</span>
              {p.pedido}
            </p>
          )}

          <nav aria-label="Secciones del presupuesto" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <ul className="flex min-w-max gap-1 border-b">
              {visibles.map((t) => (
                <li key={t}>
                  <Link
                    href={`?tab=${t}`}
                    scroll={false}
                    aria-current={pedida === t ? "page" : undefined}
                    className={cn(
                      "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
                      pedida === t ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PESTANAS[t]}
                    {marca[t] && (
                      <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", marca[t]!.alerta ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{marca[t]!.texto}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {pedida === "presupuesto" && (
            <>
              <Seccion titulo={`Ítems${p.revisionActual ? ` · ${p.revisiones[0].codigo}${borrador ? " (borrador)" : ""}` : ""}`}>
                {editableItems ? (
                  <ItemsEditor
                    guardar={accionGuardarItems.bind(null, p.id)}
                    inicial={p.items.map((i) => ({ ...i, precioUnitario: i.precioUnitario ?? 0, descripcion: i.descripcionManual ? i.descripcion : null }))}
                    moneda={p.moneda}
                    bonificacion={p.bonificacion}
                    incluyeIva={p.incluyeIva}
                    ivaPct={p.ivaPct}
                  />
                ) : p.items.length === 0 ? (
                  <Vacio>Sin ítems cargados.</Vacio>
                ) : (
                  <div className="rounded-xl border bg-card">
                    <ul className="divide-y text-sm">
                      {p.items.map((i) => (
                        <li key={i.id} className="grid grid-cols-[2rem_1fr_auto] gap-x-3 gap-y-0.5 p-3 sm:grid-cols-[2rem_1fr_6rem_8rem]">
                          <span className="text-muted-foreground tabular-nums">{i.nro}</span>
                          <span>{i.descripcion}</span>
                          <span className="text-right tabular-nums">
                            {i.cantidad} {UNIDADES[i.unidad]}
                          </span>
                          {p.verMontos && (
                            <span className="col-start-2 text-sm text-muted-foreground tabular-nums sm:col-start-auto sm:text-right sm:text-foreground">
                              {formatearMonto(i.precioUnitario ?? 0, p.moneda)}
                              <span className="sm:hidden"> c/u</span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {p.totales && (
                      <p className="flex justify-between border-t bg-muted/40 p-3 font-semibold tabular-nums">
                        <span>Total neto</span>
                        <span>{formatearMonto(p.totales.neto, p.moneda)}</span>
                      </p>
                    )}
                  </div>
                )}
              </Seccion>

              {editableItems && (
                <Seccion titulo="Condiciones comerciales">
                  <ComercialesForm p={p} />
                </Seccion>
              )}

              <Seccion
                titulo="Revisiones y documento"
                accion={
                  verDocumento && p.revisionActual ? (
                    <Link href={`/presupuestos/${p.id}/documento`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <FileText data-icon="inline-start" /> {borrador && !cerrado ? "Editar textos del documento" : "Ver documento"}
                    </Link>
                  ) : null
                }
              >
                <ul className="divide-y rounded-xl border bg-card text-sm">
                  {p.revisiones.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                      <span className="font-semibold tabular-nums">{r.codigo}</span>
                      <span className={cn("text-xs", r.estado === "emitida" ? "font-semibold text-success" : "text-muted-foreground")}>
                        {r.estado === "borrador" ? "Borrador" : r.estado === "emitida" ? `Vigente · emitida ${r.emitidaAt ? fecha.format(r.emitidaAt) : ""}` : "Reemplazada"}
                      </span>
                      {r.total != null && <span className="ml-auto tabular-nums">{formatearMonto(r.total, p.moneda)}</span>}
                      {verDocumento &&
                        (() => {
                          const d = docs.find((x) => x.revisionId === r.id);
                          return d ? <Descargas documentoId={d.id} pdfPendiente={d.pdfEstado !== "ok"} /> : null;
                        })()}
                    </li>
                  ))}
                </ul>
                {!cerrado && (
                  <BotonesRevision
                    id={p.id}
                    puedeEmitir={borrador && puede("documentos", "emitir")}
                    puedeNueva={!borrador && puede("presupuestos", "escribir")}
                    puedeEliminar={!ultimaEmitida && !p.revisiones.some((r) => r.estado === "reemplazada") && puede("presupuestos", "eliminar")}
                  />
                )}
              </Seccion>

              {(adicionales.length > 0 || ["en_progreso", "pendiente_liquidacion"].includes(p.estado)) && (
                <Seccion
                  titulo="Trabajos adicionales"
                  accion={["en_progreso", "pendiente_liquidacion"].includes(p.estado) && puede("presupuestos", "escribir") ? <BotonCrearAdicional presupuestoId={p.id} /> : null}
                >
                  {adicionales.length === 0 ? (
                    <Vacio>Sin trabajos adicionales. Si se ejecuta más de lo cotizado, creá uno para cobrarlo.</Vacio>
                  ) : (
                    <ul className="divide-y rounded-xl border bg-card text-sm">
                      {adicionales.map((a) => (
                        <li key={a.id}>
                          <Link href={`/presupuestos/${p.id}/adicionales/${a.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted/60">
                            <span className="font-semibold tabular-nums">{a.codigo}</span>
                            <EstadoAdicionalBadge estado={a.estado} />
                            {a.total != null && <span className="ml-auto tabular-nums">{formatearMonto(a.total, p.moneda)}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Seccion>
              )}

              {(p.requiereVisita || p.visitas.length > 0) && puede("agenda", "leer") && (
                <Seccion titulo="Visitas técnicas" accion={!cerrado && puede("agenda", "escribir") ? <AgendarVisita presupuestoId={p.id} direccion={p.obra?.direccion ?? null} usuarios={usuarios} /> : null}>
                  {p.visitas.length === 0 ? (
                    <Vacio>Requiere visita técnica: todavía no está agendada.</Vacio>
                  ) : (
                    <ul className="space-y-3">
                      {p.visitas.map((v) => (
                        <li key={v.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                            <span className="font-semibold">{v.inicio ? fechaHora.format(v.inicio) : "Sin fecha"}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", v.estado === "realizada" ? "bg-success/15 text-success" : v.estado === "agendada" ? "bg-info/15 text-info" : "bg-muted")}>
                              {ESTADO_VISITA[v.estado]}
                            </span>
                          </div>
                          {v.direccion && <p>{v.direccion}</p>}
                          {(() => {
                            const rs = responsables.filter((r) => r.visitaId === v.id).map((r) => r.name);
                            return rs.length ? <p className="text-muted-foreground">Responsables: {rs.join(", ")}</p> : null;
                          })()}
                          {v.notasPrevias && <p className="text-muted-foreground">{v.notasPrevias}</p>}
                          {v.notasResultado && <p className="rounded-lg bg-muted p-2 whitespace-pre-line">{v.notasResultado}</p>}
                          {v.motivoOmision && <p className="text-muted-foreground">Motivo: {v.motivoOmision}</p>}
                          {!cerrado && ["pendiente", "agendada"].includes(v.estado) && puede("agenda", "escribir") && <ResolverVisita presupuestoId={p.id} visitaId={v.id} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </Seccion>
              )}
            </>
          )}

          {pedida === "obra" && (
            <>
              {balance && (
                <Seccion
                  titulo="Campo"
                  accion={
                    <span className="flex flex-wrap gap-2">
                      {puede("documentos", "leer") && (
                        <Link href={`/presupuestos/${p.id}/reportes`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          <FileText data-icon="inline-start" /> Reportes mensuales
                        </Link>
                      )}
                      <Link href={`/presupuestos/${p.id}/campo`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <HardHat data-icon="inline-start" /> Registros y fotos
                      </Link>
                    </span>
                  }
                >
                  <TablaBalance filas={balance.filas} totales={balance.totales} verMontos={balance.verMontos} moneda={p.moneda} />
                </Seccion>
              )}
              {jornadas && (p.estado === "en_progreso" || jornadas.length > 0) && (
                <Seccion titulo="Jornadas de trabajo">
                  <Jornadas presupuestoId={p.id} jornadas={jornadas} usuarios={usuarios} editable={p.estado === "en_progreso" && puede("agenda", "escribir")} />
                </Seccion>
              )}
              {materiales && (
                <Seccion titulo="Materiales">
                  <Materiales presupuestoId={p.id} {...materiales} disponibles={disponibles} editable={p.estado === "en_progreso" && puede("stock", "escribir")} />
                </Seccion>
              )}
            </>
          )}

          {pedida === "dinero" && (
            <>
              {cobros && (
                <Seccion titulo="Cobros">
                  <Cobros presupuestoId={p.id} moneda={p.moneda} {...cobros} puedeRegistrar={puede("cobros", "escribir")} puedeEliminar={puede("cobros", "eliminar")} />
                </Seccion>
              )}
              {certificaciones && (
                <Seccion
                  titulo="Certificaciones"
                  accion={p.estado !== "terminado" && puede("documentos", "escribir") ? <BotonNuevaCertificacion presupuestoId={p.id}>Certificación de obra</BotonNuevaCertificacion> : null}
                >
                  {certificaciones.length === 0 ? (
                    <Vacio>Sin certificaciones. Certificá el avance para facturar lo ejecutado.</Vacio>
                  ) : (
                    <ul className="divide-y rounded-xl border bg-card text-sm">
                      {certificaciones.map((c) => {
                        const ad = adicionales.find((a) => a.id === c.adicionalId);
                        const cod = `${ad ? ad.codigo : p.codigo}-C${c.nro}`;
                        return (
                          <li key={c.id}>
                            <Link href={`/presupuestos/${p.id}/certificaciones/${c.id}`} className="flex min-h-12 flex-wrap items-center gap-3 p-3 hover:bg-muted">
                              <span className="min-w-0 flex-1 font-semibold">{cod}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.tipo === "final" ? "Final" : "Parcial"} · {c.estado === "emitido" ? "Emitida" : "Borrador"}
                              </span>
                              {c.total != null && <span className="tabular-nums">{formatearMonto(c.total, p.moneda)}</span>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Seccion>
              )}
              {gastos && (
                <Seccion titulo="Gastos">
                  <div className="space-y-3">
                    <ListaGastos gastos={gastos} puedeEliminar={puede("gastos", "eliminar")} />
                    {!cerrado && puede("gastos", "escribir") && (
                      <Plegable titulo="Nuevo gasto">
                        <FormGasto presupuestoId={p.id} categorias={cats} sinTitulo />
                      </Plegable>
                    )}
                  </div>
                </Seccion>
              )}
              {resumen && (
                <Seccion titulo="Resumen económico">
                  <ResumenEconomico r={resumen} />
                </Seccion>
              )}
            </>
          )}

          {pedida === "documentos" && carpeta && (
            <Seccion titulo="Documentos emitidos">
              <p className="-mt-1 text-sm text-muted-foreground">La versión vigente de cada documento, lista para descargar. Las revisiones anteriores quedan en la pestaña Presupuesto.</p>
              {carpeta.length === 0 ? (
                <Vacio>Todavía no se emitió ningún documento. Se suman acá al emitir el presupuesto, adicionales, certificaciones, controles y reportes.</Vacio>
              ) : (
                <ul className="divide-y rounded-xl border bg-card text-sm">
                  {carpeta.map((d) => {
                    const Icono = ICONO_DOC[d.tipo];
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-text" aria-hidden>
                          <Icono className="size-4.5" />
                        </span>
                        <Link href={d.ruta} className="min-w-0 flex-1 hover:underline">
                          <span className="block font-semibold">{d.codigo}</span>
                          <span className="block text-xs text-muted-foreground">{[d.nombre, d.detalle, d.emitidoAt && `Emitido ${fecha.format(d.emitidoAt)}`].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <Descargas documentoId={d.id} pdfPendiente={d.pdfPendiente} destacarPdf nombre={d.codigo} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Seccion>
          )}

          {pedida === "archivos" && anexos && (
            <Seccion titulo="Anexos">
              <Anexos presupuestoId={p.id} anexos={anexos} puedeSubir={puede("anexos", "escribir")} puedeEliminar={puede("anexos", "eliminar")} />
            </Seccion>
          )}

          {pedida === "historial" && (
            <Seccion titulo="Historial">
              <ol className="relative space-y-4 border-l pl-5 text-sm">
                {p.historial.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <p>
                      {h.desde ? `${ESTADOS[h.desde as Estado]} → ` : ""}
                      <strong>{ESTADOS[h.hasta as Estado]}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {fechaHora.format(h.at)}
                      {h.usuario && ` · ${h.usuario}`}
                    </p>
                    {h.motivo && <p className="text-muted-foreground">{h.motivo}</p>}
                  </li>
                ))}
              </ol>
            </Seccion>
          )}
        </div>
      </div>
    </>
  );
}

export default function PresupuestoPage({ params, searchParams }: PageProps<"/presupuestos/[id]">) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
