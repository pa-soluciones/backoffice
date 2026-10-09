import "server-only";
import { and, asc, count, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, directoresObra, obras } from "@/db/schema";
import { cuitValido, formatearCuit } from "@/domain/cuit";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Clientes (= contratistas). spec/04 §2.

export type DatosCliente = {
  razonSocial: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
};

const vivos = isNull(clientes.deletedAt);

function normalizar(d: DatosCliente): DatosCliente {
  if (d.cuit && !cuitValido(d.cuit)) throw new ErrorNegocio("El CUIT no es válido (revisá el dígito verificador).");
  return { ...d, razonSocial: d.razonSocial.trim().replace(/\s+/g, " "), cuit: d.cuit ? formatearCuit(d.cuit) : null };
}

/** Postgres 23505 = violación de índice único (razón social repetida). */
function traducirDuplicado(e: unknown): never {
  const code = (e as { code?: string; cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
  if (code === "23505") throw new ErrorNegocio("Ya existe un cliente con esa razón social.");
  throw e;
}

export async function listarClientes(opts: { archivados?: boolean; orden?: "nombre" | "actividad"; limite?: number; desde?: number } = {}) {
  await requirePermiso("clientes", "leer");
  const actividad = sql<Date>`greatest(${clientes.updatedAt}, coalesce(${max(obras.updatedAt)}, ${clientes.updatedAt}))`;
  return db
    .select({
      id: clientes.id,
      razonSocial: clientes.razonSocial,
      archivado: clientes.archivado,
      obras: count(obras.id),
      actividad,
    })
    .from(clientes)
    .leftJoin(obras, and(eq(obras.clienteId, clientes.id), isNull(obras.deletedAt)))
    .where(and(vivos, eq(clientes.archivado, !!opts.archivados)))
    .groupBy(clientes.id)
    .orderBy(opts.orden === "actividad" ? desc(actividad) : asc(clientes.razonSocial))
    .limit(opts.limite ?? 10_000)
    .offset(opts.desde ?? 0);
}

export async function obtenerCliente(id: string) {
  await requirePermiso("clientes", "leer");
  const [c] = await db.select().from(clientes).where(and(eq(clientes.id, id), vivos));
  if (!c) return null;
  const lista = await db
    .select({
      id: obras.id,
      nombre: obras.nombre,
      direccion: obras.direccion,
      director: directoresObra.nombre,
      updatedAt: obras.updatedAt,
    })
    .from(obras)
    .leftJoin(directoresObra, eq(directoresObra.id, obras.directorId))
    .where(and(eq(obras.clienteId, id), isNull(obras.deletedAt)))
    .orderBy(desc(obras.updatedAt));
  return { ...c, obras: lista };
}

/** Clientes parecidos para avisar posibles duplicados (RF-CLI-04). */
export async function sugerirClientes(texto: string, excepto?: string) {
  await requirePermiso("clientes", "leer");
  const q = texto.trim();
  if (q.length < 3) return [];
  const sim = sql<number>`similarity(f_unaccent(lower(${clientes.razonSocial})), f_unaccent(lower(${q})))`;
  const rows = await db
    .select({ id: clientes.id, razonSocial: clientes.razonSocial, sim })
    .from(clientes)
    .where(and(vivos, sql`${sim} >= 0.3`))
    .orderBy(desc(sim))
    .limit(5);
  return rows.filter((r) => r.id !== excepto);
}

export async function crearCliente(datos: DatosCliente) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  const d = normalizar(datos);
  const [c] = await db
    .insert(clientes)
    .values({ ...d, createdBy: usuario.id })
    .returning({ id: clientes.id })
    .catch(traducirDuplicado);
  await auditar({ actorUserId: usuario.id, action: "cliente.crear", entityType: "cliente", entityId: c.id, entityLabel: d.razonSocial, diff: d });
  return c.id;
}

export async function actualizarCliente(id: string, datos: DatosCliente) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  const d = normalizar(datos);
  const [antes] = await db.select().from(clientes).where(and(eq(clientes.id, id), vivos));
  if (!antes) throw new ErrorNegocio("El cliente no existe.");
  await db
    .update(clientes)
    .set({ ...d, updatedAt: new Date() })
    .where(eq(clientes.id, id))
    .catch(traducirDuplicado);
  const diff = Object.fromEntries(
    (Object.keys(d) as (keyof DatosCliente)[]).filter((k) => antes[k] !== d[k]).map((k) => [k, [antes[k], d[k]]]),
  );
  await auditar({ actorUserId: usuario.id, action: "cliente.actualizar", entityType: "cliente", entityId: id, entityLabel: d.razonSocial, diff });
}

export async function archivarCliente(id: string, archivado: boolean) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  await db.update(clientes).set({ archivado, updatedAt: new Date() }).where(eq(clientes.id, id));
  await auditar({ actorUserId: usuario.id, action: archivado ? "cliente.archivar" : "cliente.desarchivar", entityType: "cliente", entityId: id });
}

/** Solo sin obras (RF-CLI-03); si tiene historia, se archiva. */
export async function eliminarCliente(id: string) {
  const { usuario } = await requirePermiso("clientes", "eliminar");
  const [{ n }] = await db.select({ n: count() }).from(obras).where(and(eq(obras.clienteId, id), isNull(obras.deletedAt)));
  if (n > 0) throw new ErrorNegocio("El cliente tiene obras: archivalo en lugar de eliminarlo.");
  const [c] = await db.update(clientes).set({ deletedAt: new Date() }).where(eq(clientes.id, id)).returning();
  await auditar({ actorUserId: usuario.id, action: "cliente.eliminar", entityType: "cliente", entityId: id, entityLabel: c?.razonSocial });
}
