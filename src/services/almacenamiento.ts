import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { archivos } from "@/db/schema";
import * as r2 from "@/lib/r2";
import { ErrorNegocio } from "./errores";
import { reservarAlmacenamiento, reservarOperaciones } from "./cuota-r2";

// Única puerta a R2: cada operación reserva cupo del free tier antes de ejecutarse.
// En R2: PUT = clase A, GET y HEAD = clase B, DELETE es gratis.

export const MAX_BYTES = 30 * 1024 * 1024; // spec/06 RF-ANX-02

type Meta = { nombre: string; mime: string; entidadTipo?: string; entidadId?: string; categoria?: string; createdBy?: string };

const nuevaKey = (nombre: string) => `${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${nombre.replace(/[^\w.-]+/g, "_").slice(-80)}`;

/** Subida desde el servidor (documentos generados, PDF). */
export async function guardarArchivo(cuerpo: Uint8Array, meta: Meta) {
  if (cuerpo.byteLength > MAX_BYTES) throw new ErrorNegocio("El archivo supera los 30 MB.");
  await reservarOperaciones("opsA");
  const archivo = await reservarAlmacenamiento({
    ...meta,
    r2Key: nuevaKey(meta.nombre),
    bytes: cuerpo.byteLength,
    sha256: createHash("sha256").update(cuerpo).digest("hex"),
  });
  try {
    await r2.subir(archivo.r2Key, cuerpo, meta.mime);
  } catch (e) {
    await db.delete(archivos).where(eq(archivos.id, archivo.id)); // libera la reserva
    throw e;
  }
  await db.update(archivos).set({ estado: "ok" }).where(eq(archivos.id, archivo.id));
  return archivo.id;
}

/** Subida directa del navegador: reserva espacio con el tamaño declarado y devuelve la URL firmada. */
export async function prepararSubida(bytes: number, meta: Meta) {
  if (bytes <= 0 || bytes > MAX_BYTES) throw new ErrorNegocio("El archivo supera los 30 MB.");
  await reservarOperaciones("opsA");
  const archivo = await reservarAlmacenamiento({ ...meta, r2Key: nuevaKey(meta.nombre), bytes });
  return { archivoId: archivo.id, url: await r2.urlSubidaFirmada(archivo.r2Key) };
}

/** Confirma la subida directa con el tamaño real (si mintieron el tamaño, se borra). */
export async function confirmarSubida(archivoId: string) {
  const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
  if (!a || a.estado !== "pendiente") throw new ErrorNegocio("La subida no existe o ya se confirmó.");
  await reservarOperaciones("opsB"); // HEAD
  const real = await r2.tamanio(a.r2Key);
  if (real == null || real > a.bytes) {
    await eliminarArchivo(archivoId);
    throw new ErrorNegocio("La subida no se completó o el archivo no coincide con el tamaño declarado.");
  }
  await db.update(archivos).set({ estado: "ok", bytes: real }).where(eq(archivos.id, archivoId));
}

export async function urlDescarga(archivoId: string) {
  const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
  if (!a || a.deletedAt || a.estado !== "ok") throw new ErrorNegocio("El archivo no existe.");
  await reservarOperaciones("opsB");
  return r2.urlDescargaFirmada(a.r2Key, a.nombre);
}

/** Borra de R2 (libera almacenamiento) y marca el registro. */
export async function eliminarArchivo(archivoId: string) {
  const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
  if (!a || a.deletedAt) return;
  await r2.borrar(a.r2Key);
  await db.update(archivos).set({ deletedAt: new Date() }).where(eq(archivos.id, archivoId));
}

/** Subidas del navegador que nunca se confirmaron: liberan el espacio reservado. Lo llama el cron diario. */
export async function limpiarPendientes(horas = 24) {
  const viejos = await db
    .select({ id: archivos.id })
    .from(archivos)
    .where(and(eq(archivos.estado, "pendiente"), lt(archivos.createdAt, new Date(Date.now() - horas * 3_600_000))));
  for (const a of viejos) await eliminarArchivo(a.id);
  return viejos.length;
}
