import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { configuracion } from "@/db/schema";
import { FIRMA_MAX_BYTES, pngDimensiones } from "@/domain/archivos";
import type { Firma } from "@/documents/render";
import { eliminarArchivo, guardarArchivo, leerArchivo, urlDescarga } from "./almacenamiento";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Imagen de firma de la empresa (spec/06 §6): va debajo de "Atentamente." en los documentos.
// Se lee al emitir: los documentos ya emitidos conservan la firma con la que se generaron.

const CLAVE = "firma_empresa";
type Valor = { archivoId: string; ancho: number; alto: number };

async function actual(): Promise<Valor | null> {
  const [r] = await db.select().from(configuracion).where(eq(configuracion.clave, CLAVE));
  return (r?.valor as Valor | undefined) ?? null;
}

/** Para Ajustes: URL firmada de la imagen actual (o null). */
export async function verFirma() {
  await requirePermiso("configuracion", "leer");
  const f = await actual();
  return f ? { url: await urlDescarga(f.archivoId) } : null;
}

export async function guardarFirma(png: Uint8Array) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  if (png.byteLength > FIRMA_MAX_BYTES) throw new ErrorNegocio("La firma tiene que pesar como máximo 1 MB.");
  const dim = pngDimensiones(png);
  if (!dim) throw new ErrorNegocio("La firma tiene que ser una imagen PNG (idealmente con fondo transparente).");
  const anterior = await actual();
  const archivoId = await guardarArchivo(png, { nombre: "firma-empresa.png", mime: "image/png", entidadTipo: "empresa", categoria: "firma", createdBy: usuario.id });
  const valor: Valor = { archivoId, ...dim };
  await db.insert(configuracion).values({ clave: CLAVE, valor }).onConflictDoUpdate({ target: configuracion.clave, set: { valor, updatedAt: new Date() } });
  if (anterior) await eliminarArchivo(anterior.archivoId);
  await auditar({ actorUserId: usuario.id, action: "configuracion.firma", entityType: "configuracion", entityId: CLAVE, diff: { accion: "cargar", ...dim } });
}

export async function quitarFirma() {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  const anterior = await actual();
  if (!anterior) return;
  await db.delete(configuracion).where(eq(configuracion.clave, CLAVE));
  await eliminarArchivo(anterior.archivoId);
  await auditar({ actorUserId: usuario.id, action: "configuracion.firma", entityType: "configuracion", entityId: CLAVE, diff: { accion: "quitar" } });
}

/** Sin permiso: la usan los servicios al generar documentos. */
export async function firmaParaDocumento(): Promise<Firma | null> {
  const f = await actual();
  return f ? { png: await leerArchivo(f.archivoId), ancho: f.ancho, alto: f.alto } : null;
}
