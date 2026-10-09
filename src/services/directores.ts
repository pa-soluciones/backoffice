import "server-only";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientes, directoresObra, obras } from "@/db/schema";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Directores de obra: reutilizables entre obras y clientes (spec/04 §3). Permiso: módulo clientes.

export type DatosDirector = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  empresa: string | null;
  notas: string | null;
};

const vivos = isNull(directoresObra.deletedAt);

export async function listarDirectores() {
  await requirePermiso("clientes", "leer");
  return db
    .select({ id: directoresObra.id, nombre: directoresObra.nombre, empresa: directoresObra.empresa, obras: count(obras.id) })
    .from(directoresObra)
    .leftJoin(obras, and(eq(obras.directorId, directoresObra.id), isNull(obras.deletedAt)))
    .where(vivos)
    .groupBy(directoresObra.id)
    .orderBy(asc(directoresObra.nombre));
}

/** Para selects (obra). */
export async function opcionesDirectores() {
  await requirePermiso("clientes", "leer");
  return db.select({ id: directoresObra.id, nombre: directoresObra.nombre, empresa: directoresObra.empresa }).from(directoresObra).where(vivos).orderBy(asc(directoresObra.nombre));
}

export async function obtenerDirector(id: string) {
  await requirePermiso("clientes", "leer");
  const [d] = await db.select().from(directoresObra).where(and(eq(directoresObra.id, id), vivos));
  if (!d) return null;
  // RF-DIR-03: todas sus obras, con cualquier cliente.
  const lista = await db
    .select({ id: obras.id, direccion: obras.direccion, nombre: obras.nombre, clienteId: clientes.id, cliente: clientes.razonSocial })
    .from(obras)
    .innerJoin(clientes, eq(clientes.id, obras.clienteId))
    .where(and(eq(obras.directorId, id), isNull(obras.deletedAt)))
    .orderBy(desc(obras.updatedAt));
  return { ...d, obras: lista };
}

export async function crearDirector(d: DatosDirector) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  const [r] = await db
    .insert(directoresObra)
    .values({ ...d, nombre: d.nombre.trim(), createdBy: usuario.id })
    .returning({ id: directoresObra.id });
  await auditar({ actorUserId: usuario.id, action: "director.crear", entityType: "director", entityId: r.id, entityLabel: d.nombre, diff: d });
  return r.id;
}

export async function actualizarDirector(id: string, d: DatosDirector) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  const [antes] = await db.select().from(directoresObra).where(and(eq(directoresObra.id, id), vivos));
  if (!antes) throw new ErrorNegocio("El director no existe.");
  await db.update(directoresObra).set({ ...d, nombre: d.nombre.trim(), updatedAt: new Date() }).where(eq(directoresObra.id, id));
  const diff = Object.fromEntries(
    (Object.keys(d) as (keyof DatosDirector)[]).filter((k) => antes[k] !== d[k]).map((k) => [k, [antes[k], d[k]]]),
  );
  await auditar({ actorUserId: usuario.id, action: "director.actualizar", entityType: "director", entityId: id, entityLabel: d.nombre, diff });
}

export async function eliminarDirector(id: string) {
  const { usuario } = await requirePermiso("clientes", "eliminar");
  const [{ n }] = await db.select({ n: count() }).from(obras).where(and(eq(obras.directorId, id), isNull(obras.deletedAt)));
  if (n > 0) throw new ErrorNegocio(`El director está asignado a ${n} obra(s). Cambiá el director de esas obras primero.`);
  const [d] = await db.update(directoresObra).set({ deletedAt: new Date() }).where(eq(directoresObra.id, id)).returning();
  await auditar({ actorUserId: usuario.id, action: "director.eliminar", entityType: "director", entityId: id, entityLabel: d?.nombre });
}
