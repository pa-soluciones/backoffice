import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, jornadaOperarios, jornadas, obras, presupuestoAsignados, presupuestos, user, visitaResponsables, visitas } from "@/db/schema";
import { auditar } from "./auditoria";
import { destinatarios, notificar } from "./notificaciones";
import { ErrorNegocio } from "./errores";
import { codigo } from "./presupuestos";
import { requirePermiso } from "./sesion";

// Visitas técnicas y agenda (spec/05 §6). Permiso: módulo agenda.

export type DatosVisita = {
  inicio: Date | null;
  duracionMin: number;
  direccion: string | null;
  contactoSitio: string | null;
  notasPrevias: string | null;
  responsables: string[];
};

async function presupuestoAccesible(presupuestoId: string, userId: string, alcance: "todos" | "asignados") {
  const [p] = await db.select().from(presupuestos).where(and(eq(presupuestos.id, presupuestoId), isNull(presupuestos.deletedAt)));
  if (!p) throw new ErrorNegocio("El presupuesto no existe.");
  if (alcance === "asignados") {
    const [a] = await db.select().from(presupuestoAsignados).where(and(eq(presupuestoAsignados.presupuestoId, presupuestoId), eq(presupuestoAsignados.userId, userId)));
    if (!a) throw new ErrorNegocio("No estás asignado a este presupuesto.");
  }
  return p;
}

export async function agendarVisita(presupuestoId: string, d: DatosVisita) {
  const { usuario, alcance } = await requirePermiso("agenda", "escribir");
  const p = await presupuestoAccesible(presupuestoId, usuario.id, alcance);
  const [v] = await db
    .insert(visitas)
    .values({
      presupuestoId,
      inicio: d.inicio,
      duracionMin: d.duracionMin,
      direccion: d.direccion,
      contactoSitio: d.contactoSitio,
      notasPrevias: d.notasPrevias,
      estado: d.inicio ? "agendada" : "pendiente",
    })
    .returning({ id: visitas.id });
  if (d.responsables.length) await db.insert(visitaResponsables).values(d.responsables.map((userId) => ({ visitaId: v.id, userId })));
  await auditar({ actorUserId: usuario.id, action: "visita.agendar", entityType: "presupuesto", entityId: presupuestoId, entityLabel: codigo(p) ?? undefined, diff: d });
  if (d.inicio) {
    const cuando = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(d.inicio);
    await notificar(await destinatarios({ usuarios: d.responsables, actorId: usuario.id }), {
      tipo: "visita_agendada",
      titulo: `Visita técnica ${codigo(p) ?? ""}: ${cuando}`.replace("  ", " "),
      cuerpo: d.direccion,
      link: "/agenda",
      entidadTipo: "visita",
      entidadId: v.id,
    });
  }
  return v.id;
}

export async function resolverVisita(visitaId: string, estado: "realizada" | "omitida" | "cancelada", notas: string | null) {
  const { usuario, alcance } = await requirePermiso("agenda", "escribir");
  const [v] = await db.select().from(visitas).where(eq(visitas.id, visitaId));
  if (!v) throw new ErrorNegocio("La visita no existe.");
  const p = await presupuestoAccesible(v.presupuestoId, usuario.id, alcance);
  if (estado === "omitida" && !notas?.trim()) throw new ErrorNegocio("Indicá por qué se omite la visita.");
  await db
    .update(visitas)
    .set({
      estado,
      ...(estado === "realizada" ? { notasResultado: notas } : { motivoOmision: notas }),
      updatedAt: new Date(),
    })
    .where(eq(visitas.id, visitaId));
  await auditar({ actorUserId: usuario.id, action: `visita.${estado}`, entityType: "presupuesto", entityId: v.presupuestoId, entityLabel: codigo(p) ?? undefined, diff: { notas } });
}

/** Visitas en un rango [desde, hasta). Con alcance "asignados": propias o de presupuestos asignados. */
export async function listarAgenda(desde: Date, hasta: Date) {
  const { usuario, alcance } = await requirePermiso("agenda", "leer");
  const propias =
    alcance === "asignados"
      ? or(
          sql`exists (select 1 from visita_responsables vr where vr.visita_id = ${visitas.id} and vr.user_id = ${usuario.id})`,
          sql`exists (select 1 from presupuesto_asignados pa where pa.presupuesto_id = ${visitas.presupuestoId} and pa.user_id = ${usuario.id})`,
        )
      : undefined;
  const rows = await db
    .select({
      v: visitas,
      p: { id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero, contactoNombre: presupuestos.contactoNombre },
      cliente: clientes.razonSocial,
      obra: obras.direccion,
    })
    .from(visitas)
    .innerJoin(presupuestos, eq(presupuestos.id, visitas.presupuestoId))
    .leftJoin(clientes, eq(clientes.id, presupuestos.clienteId))
    .leftJoin(obras, eq(obras.id, presupuestos.obraId))
    .where(and(gte(visitas.inicio, desde), lt(visitas.inicio, hasta), inArray(visitas.estado, ["agendada", "realizada"]), isNull(presupuestos.deletedAt), propias))
    .orderBy(asc(visitas.inicio));

  const ids = rows.map((r) => r.v.id);
  const resp = ids.length
    ? await db.select({ visitaId: visitaResponsables.visitaId, name: user.name }).from(visitaResponsables).innerJoin(user, eq(user.id, visitaResponsables.userId)).where(inArray(visitaResponsables.visitaId, ids))
    : [];

  return rows.map(({ v, p, cliente, obra }) => ({
    ...v,
    presupuestoId: p.id,
    codigo: codigo(p),
    cliente: cliente ?? p.contactoNombre ?? "Sin cliente",
    direccion: v.direccion ?? obra,
    responsables: resp.filter((r) => r.visitaId === v.id).map((r) => r.name),
  }));
}

/** Responsables por visita (detalle del presupuesto). */
export async function responsablesDeVisitas(visitaIds: string[]) {
  if (!visitaIds.length) return [];
  return db.select({ visitaId: visitaResponsables.visitaId, name: user.name }).from(visitaResponsables).innerJoin(user, eq(user.id, visitaResponsables.userId)).where(inArray(visitaResponsables.visitaId, visitaIds));
}

// ── Jornadas de trabajo (spec/05 RF-AGE-05) ───────────────────────────────────

export async function planificarJornada(presupuestoId: string, d: { fecha: string; operarios: string[]; notas: string | null }) {
  const { usuario, alcance } = await requirePermiso("agenda", "escribir");
  const p = await presupuestoAccesible(presupuestoId, usuario.id, alcance);
  if (p.estado !== "en_progreso") throw new ErrorNegocio("Las jornadas se planifican con el presupuesto En progreso.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) throw new ErrorNegocio("Indicá la fecha.");
  if (!d.operarios.length) throw new ErrorNegocio("Elegí al menos un operario.");
  const id = await db.transaction(async (tx) => {
    const [j] = await tx.insert(jornadas).values({ presupuestoId, fecha: d.fecha, notas: d.notas?.trim() || null, createdBy: usuario.id }).returning({ id: jornadas.id });
    await tx.insert(jornadaOperarios).values([...new Set(d.operarios)].map((userId) => ({ jornadaId: j.id, userId })));
    return j.id;
  });
  await auditar({ actorUserId: usuario.id, action: "jornada.planificar", entityType: "presupuesto", entityId: presupuestoId, entityLabel: codigo(p) ?? undefined, diff: d });
  const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${d.fecha}T12:00:00Z`));
  await notificar(d.operarios.filter((u) => u !== usuario.id), { tipo: "recordatorio_jornada", titulo: `Jornada de trabajo en ${codigo(p) ?? "la obra"}: ${fecha}`, cuerpo: d.notas, link: "/agenda", entidadTipo: "jornada", entidadId: id });
  return id;
}

export async function eliminarJornada(jornadaId: string) {
  const { usuario, alcance } = await requirePermiso("agenda", "eliminar");
  const [j] = await db.select().from(jornadas).where(eq(jornadas.id, jornadaId));
  if (!j) throw new ErrorNegocio("La jornada no existe.");
  await presupuestoAccesible(j.presupuestoId, usuario.id, alcance);
  await db.delete(jornadas).where(eq(jornadas.id, jornadaId));
  await auditar({ actorUserId: usuario.id, action: "jornada.eliminar", entityType: "presupuesto", entityId: j.presupuestoId, diff: { fecha: j.fecha } });
}

/** Jornadas entre dos días (inclusive), con el mismo alcance que las visitas. */
export async function listarJornadas(desde: string, hasta: string, presupuestoId?: string) {
  const { usuario, alcance } = await requirePermiso("agenda", "leer");
  const propias =
    alcance === "asignados"
      ? or(
          sql`exists (select 1 from jornada_operarios jo where jo.jornada_id = ${jornadas.id} and jo.user_id = ${usuario.id})`,
          sql`exists (select 1 from presupuesto_asignados pa where pa.presupuesto_id = ${jornadas.presupuestoId} and pa.user_id = ${usuario.id})`,
        )
      : undefined;
  const rows = await db
    .select({ j: jornadas, p: { id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero }, cliente: clientes.razonSocial, obra: obras.direccion })
    .from(jornadas)
    .innerJoin(presupuestos, eq(presupuestos.id, jornadas.presupuestoId))
    .leftJoin(clientes, eq(clientes.id, presupuestos.clienteId))
    .leftJoin(obras, eq(obras.id, presupuestos.obraId))
    .where(and(gte(jornadas.fecha, desde), lte(jornadas.fecha, hasta), presupuestoId ? eq(jornadas.presupuestoId, presupuestoId) : undefined, propias))
    .orderBy(asc(jornadas.fecha));
  const ids = rows.map((r) => r.j.id);
  const ops = ids.length
    ? await db.select({ jornadaId: jornadaOperarios.jornadaId, name: user.name }).from(jornadaOperarios).innerJoin(user, eq(user.id, jornadaOperarios.userId)).where(inArray(jornadaOperarios.jornadaId, ids))
    : [];
  return rows.map(({ j, p, cliente, obra }) => ({
    ...j,
    codigo: codigo(p),
    cliente: cliente ?? "Sin cliente",
    direccion: obra,
    operarios: ops.filter((o) => o.jornadaId === j.id).map((o) => o.name),
  }));
}
