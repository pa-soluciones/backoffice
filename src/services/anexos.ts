import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { archivos, presupuestos, user } from "@/db/schema";
import { CATEGORIAS_ANEXO } from "@/domain/archivos";
import { confirmarSubida, eliminarArchivo, prepararSubida, urlDescarga } from "./almacenamiento";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { acceso, codigo } from "./presupuesto-acceso";

// Anexos de un presupuesto (spec/06 §7): fotos, planos, órdenes de compra… El archivo sube directo
// del navegador a R2 (ya optimizado si es imagen) y acá se reserva cupo y se confirma.

const ENTIDAD = "presupuesto";

async function etiqueta(presupuestoId: string) {
  const [p] = await db.select({ anio: presupuestos.anio, numero: presupuestos.numero }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  return p ? (codigo(p) ?? "sin numerar") : undefined;
}

export async function listarAnexos(presupuestoId: string) {
  await acceso(presupuestoId, "anexos", "leer");
  return db
    .select({ id: archivos.id, nombre: archivos.nombre, mime: archivos.mime, bytes: archivos.bytes, categoria: archivos.categoria, descripcion: archivos.descripcion, createdAt: archivos.createdAt, autor: user.name })
    .from(archivos)
    .leftJoin(user, eq(user.id, archivos.createdBy))
    .where(and(eq(archivos.entidadTipo, ENTIDAD), eq(archivos.entidadId, presupuestoId), eq(archivos.estado, "ok"), isNull(archivos.deletedAt)))
    .orderBy(desc(archivos.createdAt));
}

export async function prepararAnexo(presupuestoId: string, d: { nombre: string; mime: string; bytes: number; categoria: string; descripcion: string | null }) {
  const { usuario } = await acceso(presupuestoId, "anexos", "escribir");
  if (!(CATEGORIAS_ANEXO as readonly string[]).includes(d.categoria)) throw new ErrorNegocio("Categoría inválida.");
  return prepararSubida(d.bytes, {
    nombre: d.nombre.slice(0, 200),
    mime: d.mime,
    entidadTipo: ENTIDAD,
    entidadId: presupuestoId,
    categoria: d.categoria,
    createdBy: usuario.id,
    ...(d.descripcion ? { descripcion: d.descripcion.slice(0, 500) } : {}),
  });
}

async function anexoDe(archivoId: string) {
  const [a] = await db.select().from(archivos).where(and(eq(archivos.id, archivoId), eq(archivos.entidadTipo, ENTIDAD)));
  if (!a?.entidadId) throw new ErrorNegocio("El anexo no existe.");
  return { ...a, presupuestoId: a.entidadId };
}

export async function confirmarAnexo(archivoId: string) {
  const a = await anexoDe(archivoId);
  const { usuario } = await acceso(a.presupuestoId, "anexos", "escribir");
  if (a.createdBy !== usuario.id) throw new ErrorNegocio("Solo quien subió el archivo puede confirmarlo.");
  await confirmarSubida(archivoId);
  await auditar({ actorUserId: usuario.id, action: "anexo.subir", entityType: "presupuesto", entityId: a.presupuestoId, entityLabel: await etiqueta(a.presupuestoId), diff: { nombre: a.nombre, categoria: a.categoria } });
}

export async function urlAnexo(archivoId: string) {
  const a = await anexoDe(archivoId);
  await acceso(a.presupuestoId, "anexos", "leer");
  return urlDescarga(archivoId);
}

export async function eliminarAnexo(archivoId: string) {
  const a = await anexoDe(archivoId);
  const { usuario } = await acceso(a.presupuestoId, "anexos", "eliminar");
  await eliminarArchivo(archivoId);
  await auditar({ actorUserId: usuario.id, action: "anexo.eliminar", entityType: "presupuesto", entityId: a.presupuestoId, entityLabel: await etiqueta(a.presupuestoId), diff: { nombre: a.nombre } });
}
