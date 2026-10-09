import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientes, directoresObra, obras, presupuestos } from "@/db/schema";
import { auditar } from "./auditoria";
import { crearDirector } from "./directores";
import { soloAsignados } from "./presupuestos";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Obras: dirección de un cliente que contiene presupuestos (spec/04 §4).

export type DatosObra = {
  nombre: string | null;
  direccion: string;
  localidad: string | null;
  provincia: string | null;
  directorId: string | null;
  /** Si viene, se crea el director y se asigna (alta rápida desde el formulario de obra). */
  nuevoDirector: string | null;
  hysNombre: string | null;
  notas: string | null;
};

const vivas = isNull(obras.deletedAt);

/** Crear, editar y eliminar obras exige alcance "todos". */
async function exigirAlcanceTodos(accion: "escribir" | "eliminar") {
  const r = await requirePermiso("obras", accion);
  if (r.alcance !== "todos") throw new ErrorNegocio("Solo podés ver las obras de tus presupuestos asignados.");
  return r;
}

/** Con alcance "asignados" solo se ven obras con algún presupuesto asignado al usuario. */
export async function obtenerObra(id: string) {
  const { usuario, alcance } = await requirePermiso("obras", "leer");
  if (alcance === "asignados") {
    const [a] = await db
      .select({ x: presupuestos.id })
      .from(presupuestos)
      .where(and(eq(presupuestos.obraId, id), isNull(presupuestos.deletedAt), soloAsignados(usuario.id)))
      .limit(1);
    if (!a) throw new ErrorNegocio("No tenés presupuestos asignados en esta obra.");
  }
  const [o] = await db
    .select({ obra: obras, cliente: { id: clientes.id, razonSocial: clientes.razonSocial }, director: directoresObra })
    .from(obras)
    .innerJoin(clientes, eq(clientes.id, obras.clienteId))
    .leftJoin(directoresObra, eq(directoresObra.id, obras.directorId))
    .where(and(eq(obras.id, id), vivas));
  return o ?? null;
}

async function resolverDirector(d: DatosObra) {
  const nombre = d.nuevoDirector?.trim();
  if (!nombre) return d.directorId;
  return crearDirector({ nombre, telefono: null, email: null, empresa: null, notas: null });
}

const columnas = (d: DatosObra, directorId: string | null) => ({
  nombre: d.nombre,
  direccion: d.direccion.trim().replace(/\s+/g, " "),
  localidad: d.localidad,
  provincia: d.provincia,
  directorId,
  hysNombre: d.hysNombre,
  notas: d.notas,
});

export async function crearObra(clienteId: string, d: DatosObra) {
  const { usuario } = await exigirAlcanceTodos("escribir");
  const [c] = await db.select({ id: clientes.id }).from(clientes).where(and(eq(clientes.id, clienteId), isNull(clientes.deletedAt)));
  if (!c) throw new ErrorNegocio("El cliente no existe.");
  const valores = columnas(d, await resolverDirector(d));
  const [o] = await db
    .insert(obras)
    .values({ ...valores, clienteId, createdBy: usuario.id })
    .returning({ id: obras.id });
  await db.update(clientes).set({ updatedAt: new Date() }).where(eq(clientes.id, clienteId));
  await auditar({ actorUserId: usuario.id, action: "obra.crear", entityType: "obra", entityId: o.id, entityLabel: valores.direccion, diff: valores });
  return o.id;
}

export async function actualizarObra(id: string, d: DatosObra) {
  const { usuario } = await exigirAlcanceTodos("escribir");
  const [antes] = await db.select().from(obras).where(and(eq(obras.id, id), vivas));
  if (!antes) throw new ErrorNegocio("La obra no existe.");
  const valores = columnas(d, await resolverDirector(d));
  await db.update(obras).set({ ...valores, updatedAt: new Date() }).where(eq(obras.id, id));
  const diff = Object.fromEntries(
    (Object.keys(valores) as (keyof typeof valores)[]).filter((k) => antes[k] !== valores[k]).map((k) => [k, [antes[k], valores[k]]]),
  );
  await auditar({ actorUserId: usuario.id, action: "obra.actualizar", entityType: "obra", entityId: id, entityLabel: valores.direccion, diff });
}

export async function eliminarObra(id: string) {
  const { usuario } = await exigirAlcanceTodos("eliminar");
  const [p] = await db.select({ x: presupuestos.id }).from(presupuestos).where(and(eq(presupuestos.obraId, id), isNull(presupuestos.deletedAt))).limit(1);
  if (p) throw new ErrorNegocio("La obra tiene presupuestos: no se puede eliminar.");
  const [o] = await db.update(obras).set({ deletedAt: new Date() }).where(eq(obras.id, id)).returning();
  await auditar({ actorUserId: usuario.id, action: "obra.eliminar", entityType: "obra", entityId: id, entityLabel: o?.direccion });
  return o?.clienteId;
}
