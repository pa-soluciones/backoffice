import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, obras, presupuestoAsignados, presupuestos, user, visitaResponsables, visitas } from "@/db/schema";
import { auditar } from "./auditoria";
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
