import { CalendarClock, FileText, HardHat, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BonificadoBadge, EstadoAdicionalBadge, EstadoBadge } from "@/components/estado-badge";
import { Migas } from "@/components/migas";
import { buttonVariants } from "@/components/ui/button";
import { UNIDADES } from "@/domain/items";
import { formatearMonto } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { destinos, ESTADOS, esFinal, type Estado } from "@/domain/workflow";
import { listarAdicionales } from "@/services/adicionales";
import { responsablesDeVisitas } from "@/services/agenda";
import { listarAnexos } from "@/services/anexos";
import { balancePresupuesto } from "@/services/campo";
import { documentosEmitidos } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { obtenerPresupuesto, opcionesUsuarios } from "@/services/presupuestos";
import { esAdmin, getPermisos, requirePermiso } from "@/services/sesion";
import { accionGuardarItems } from "../actions";
import { AccionesEstado, Reabrir } from "../_componentes/acciones-estado";
import { ComercialesForm } from "../_componentes/comerciales-form";
import { ItemsEditor } from "../_componentes/items-editor";
import { BotonCrearAdicional } from "../_componentes/adicional";
import { Anexos } from "../_componentes/anexos";
import { TablaBalance } from "../_componentes/balance";
import { Descargas } from "../_componentes/descargas";
import { BotonesRevision } from "../_componentes/revisiones";
import { AgendarVisita, ResolverVisita } from "../_componentes/visitas";

export const metadata: Metadata = { title: "Presupuesto" };

const fechaHora = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

const ESTADO_VISITA = { pendiente: "Sin fecha", agendada: "Agendada", realizada: "Realizada", omitida: "Omitida", cancelada: "Cancelada" } as const;

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

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("presupuestos", "leer");
  const { id } = await params;
  let p;
  try {
    p = await obtenerPresupuesto(id);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const permisos = await getPermisos(usuario.id);
  const puede = (m: Parameters<typeof alcanceDe>[1], a: Parameters<typeof alcanceDe>[2]) => !!alcanceDe(permisos, m, a);
  const [admin, usuarios, responsables, docs, adicionales, anexos, balance] = await Promise.all([
    esAdmin(usuario.id),
    opcionesUsuarios(),
    responsablesDeVisitas(p.visitas.map((v) => v.id)),
    documentosEmitidos(id),
    listarAdicionales(id),
    puede("anexos", "leer") ? listarAnexos(id) : null,
    puede("campo", "leer") && ["en_progreso", "pendiente_liquidacion", "terminado"].includes(p.estado) ? balancePresupuesto(id) : null,
  ]);
  const cerrado = esFinal(p.estado);
  const borrador = p.revisionActual?.estado === "borrador";
  const editableItems = !cerrado && borrador && p.verMontos && puede("presupuestos", "escribir");
  const ultimaEmitida = p.revisiones.find((r) => r.estado === "emitida");
  const vence = ultimaEmitida?.emitidaAt ? new Date(ultimaEmitida.emitidaAt.getTime() + p.validezDias * 86_400_000) : null;
  const vencida = p.estado === "en_espera" && vence && vence < new Date();
  const verDocumento = p.verMontos && puede("documentos", "leer");

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

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-bold tabular-nums md:text-3xl">{p.codigo ?? "Sin numerar"}</h1>
          <EstadoBadge estado={p.estado} />
          {p.bonificacion && <BonificadoBadge />}
          {vencida && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Oferta vencida</span>}
          {puede("presupuestos", "escribir") && !cerrado && (
            <Link href={`/presupuestos/${p.id}/editar`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}>
              <Pencil data-icon="inline-start" /> Editar datos
            </Link>
          )}
        </div>
        <p className="text-muted-foreground">
          {p.cliente?.razonSocial ?? `Prospecto sin cliente${p.contactoNombre ? `: ${p.contactoNombre}` : ""}`}
          {p.obra && ` · ${p.obra.direccion}`}
          {p.director && ` · Dir.: ${p.director}`}
        </p>
        {(p.contactoTelefono || p.contactoEmail || p.origen) && (
          <p className="text-sm text-muted-foreground">{[p.contactoTelefono, p.contactoEmail, p.origen && `Origen: ${p.origen}`].filter(Boolean).join(" · ")}</p>
        )}
        {p.pedido && <p className="rounded-xl border bg-card p-3 text-sm whitespace-pre-line">{p.pedido}</p>}
        {p.asignados.length > 0 && <p className="text-sm">Asignados: {p.asignados.map((a) => a.name).join(", ")}</p>}
      </header>

      {puede("presupuestos", "cambiar_estado") && (
        <Seccion titulo="Estado">
          {cerrado ? (
            <div className="space-y-3">
              <p className="text-sm">
                Cerrado como <strong>{ESTADOS[p.estado]}</strong>
                {p.motivoCierre ? `: ${p.motivoCierre}` : ""}.
              </p>
              {admin && <Reabrir id={p.id} />}
            </div>
          ) : (
            <AccionesEstado id={p.id} destinos={destinos(p.estado)} hoy={hoyAR()} />
          )}
        </Seccion>
      )}

      <Seccion
        titulo={`Ítems${p.revisionActual ? ` · ${p.revisiones[0].codigo}${borrador ? " (borrador)" : ""}` : ""}`}
      >
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
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin ítems cargados.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Ítem</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-right">Cant.</th>
                  {p.verMontos && <th className="p-3 text-right">Valor unidad</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3 tabular-nums">{i.nro}</td>
                    <td className="p-3">{i.descripcion}</td>
                    <td className="p-3 text-right tabular-nums">
                      {i.cantidad} {UNIDADES[i.unidad]}
                    </td>
                    {p.verMontos && <td className="p-3 text-right tabular-nums">{formatearMonto(i.precioUnitario ?? 0, p.moneda)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {p.totales && <p className="border-t p-3 text-right font-semibold tabular-nums">Total neto {formatearMonto(p.totales.neto, p.moneda)}</p>}
          </div>
        )}
      </Seccion>

      {editableItems && (
        <Seccion titulo="Condiciones comerciales">
          <ComercialesForm p={p} />
        </Seccion>
      )}

      <Seccion
        titulo="Revisiones"
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
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-mono font-semibold tabular-nums">{r.codigo}</span>
              <span className="text-muted-foreground">
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
        {vence && p.estado === "en_espera" && <p className="text-sm text-muted-foreground">Oferta válida hasta el {fecha.format(vence)}.</p>}
      </Seccion>

      {(adicionales.length > 0 || ["en_progreso", "pendiente_liquidacion"].includes(p.estado)) && (
        <Seccion
          titulo="Trabajos adicionales"
          accion={["en_progreso", "pendiente_liquidacion"].includes(p.estado) && puede("presupuestos", "escribir") ? <BotonCrearAdicional presupuestoId={p.id} /> : null}
        >
          {adicionales.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin trabajos adicionales.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {adicionales.map((a) => (
                <li key={a.id}>
                  <Link href={`/presupuestos/${p.id}/adicionales/${a.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted/60">
                    <span className="font-mono font-semibold tabular-nums">{a.codigo}</span>
                    <EstadoAdicionalBadge estado={a.estado} />
                    {a.total != null && <span className="ml-auto tabular-nums">{formatearMonto(a.total, p.moneda)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}

      {balance && (
        <Seccion
          titulo="Campo"
          accion={
            <Link href={`/presupuestos/${p.id}/campo`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <HardHat data-icon="inline-start" /> Registros y fotos
            </Link>
          }
        >
          <TablaBalance filas={balance.filas} totales={balance.totales} verMontos={balance.verMontos} moneda={p.moneda} />
        </Seccion>
      )}

      {anexos && (
        <Seccion titulo="Anexos">
          <Anexos presupuestoId={p.id} anexos={anexos} puedeSubir={puede("anexos", "escribir")} puedeEliminar={puede("anexos", "eliminar")} />
        </Seccion>
      )}

      {(p.requiereVisita || p.visitas.length > 0) && puede("agenda", "leer") && (
        <Seccion titulo="Visitas técnicas" accion={!cerrado && puede("agenda", "escribir") ? <AgendarVisita presupuestoId={p.id} direccion={p.obra?.direccion ?? null} usuarios={usuarios} /> : null}>
          {p.visitas.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Requiere visita técnica: todavía no está agendada.</p>
          ) : (
            <ul className="space-y-3">
              {p.visitas.map((v) => (
                <li key={v.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    <span className="font-semibold">{v.inicio ? fechaHora.format(v.inicio) : "Sin fecha"}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{ESTADO_VISITA[v.estado]}</span>
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

      <Seccion titulo="Historial">
        <ol className="space-y-2 text-sm">
          {p.historial.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className="text-muted-foreground tabular-nums">{fechaHora.format(h.at)}</span>
              <span>
                {h.desde ? `${ESTADOS[h.desde as Estado]} → ` : ""}
                <strong>{ESTADOS[h.hasta as Estado]}</strong>
              </span>
              {h.usuario && <span className="text-muted-foreground">· {h.usuario}</span>}
              {h.motivo && <span className="w-full text-muted-foreground">{h.motivo}</span>}
            </li>
          ))}
        </ol>
      </Seccion>
    </>
  );
}

export default function PresupuestoPage({ params }: PageProps<"/presupuestos/[id]">) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
