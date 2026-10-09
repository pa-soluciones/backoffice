import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adicionales, archivos, clientes, items, obras, presupuestoRevisiones, presupuestos, registroOperarios, registrosCampo, user } from "@/db/schema";
import { balance, type EstadoRegistro } from "@/domain/balance";
import { alcanceDe } from "@/domain/permisos";
import { confirmarSubida, eliminarArchivo, prepararSubida, urlDescarga } from "./almacenamiento";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { acceso, codigo, soloAsignados } from "./presupuesto-acceso";
import { getPermisos, requirePermiso } from "./sesion";

// Registros de campo (spec/07): perforaciones ejecutadas con fotos, y el balance contra lo cotizado.

const EN_CURSO = ["en_progreso", "pendiente_liquidacion"];
const ENTIDAD_FOTO = "registro";
const num = (s: string | null) => (s == null ? null : Number(s));

export type DatosRegistro = {
  fecha: string;
  operarios: string[];
  piso: string;
  elemento: string;
  espesorCm: number | null;
  diametroMm: number | null;
  cantidad: number;
  itemId: string | null;
  estado: EstadoRegistro;
  observacion: string | null;
};

/** Presupuestos donde el usuario puede cargar registros (RF-CMP-01). */
export async function presupuestosParaCampo() {
  const { usuario, alcance } = await requirePermiso("campo", "escribir");
  const filas = await db
    .select({ id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero, estado: presupuestos.estado, cliente: clientes.razonSocial, direccion: obras.direccion })
    .from(presupuestos)
    .leftJoin(clientes, eq(clientes.id, presupuestos.clienteId))
    .leftJoin(obras, eq(obras.id, presupuestos.obraId))
    .where(and(inArray(presupuestos.estado, EN_CURSO), isNull(presupuestos.deletedAt), alcance === "asignados" ? soloAsignados(usuario.id) : undefined))
    .orderBy(desc(presupuestos.updatedAt));
  return filas.map((f) => ({ ...f, codigo: codigo(f) }));
}

/** Ítems de perforación cotizados: revisión vigente + adicionales aprobados. */
async function itemsCotizados(presupuestoId: string) {
  const [rev] = await db
    .select({ id: presupuestoRevisiones.id })
    .from(presupuestoRevisiones)
    .where(and(eq(presupuestoRevisiones.presupuestoId, presupuestoId), eq(presupuestoRevisiones.estado, "emitida")))
    .orderBy(desc(presupuestoRevisiones.nro))
    .limit(1);
  const ads = await db
    .select({ id: adicionales.id, nro: adicionales.nro })
    .from(adicionales)
    .where(and(eq(adicionales.presupuestoId, presupuestoId), eq(adicionales.estado, "aprobado")));
  if (!rev && !ads.length) return [];
  const filas = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.tipoServicio, "perforacion"),
        or(rev ? eq(items.revisionId, rev.id) : undefined, ads.length ? inArray(items.adicionalId, ads.map((a) => a.id)) : undefined),
      ),
    )
    .orderBy(asc(items.nro));
  return filas.map((i) => ({
    id: i.id,
    origen: i.adicionalId ? `AD${ads.find((a) => a.id === i.adicionalId)!.nro}` : "Presupuesto",
    elemento: i.elemento,
    diametroMm: num(i.diametroMm),
    espesorCm: num(i.espesorCm),
    cantidad: Number(i.cantidad),
    precioUnitario: Number(i.precioUnitario),
    descripcion: i.descripcion,
  }));
}

/** Para el formulario: ítems a vincular, último registro (precarga) y operarios posibles. */
export async function contextoCarga(presupuestoId: string) {
  const { usuario } = await acceso(presupuestoId, "campo", "escribir");
  const [its, [ultimo], usuarios] = await Promise.all([
    itemsCotizados(presupuestoId),
    db.select().from(registrosCampo).where(eq(registrosCampo.presupuestoId, presupuestoId)).orderBy(desc(registrosCampo.createdAt)).limit(1),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.activo, true)).orderBy(asc(user.name)),
  ]);
  return {
    items: its.map((i) => ({ ...i, precioUnitario: undefined })), // el formulario no muestra montos
    ultimo: ultimo ? { piso: ultimo.piso, elemento: ultimo.elemento, diametroMm: num(ultimo.diametroMm), espesorCm: num(ultimo.espesorCm), itemId: ultimo.itemId } : null,
    usuarios,
    yo: usuario.id,
  };
}

function validar(d: DatosRegistro) {
  if (!d.piso.trim()) throw new ErrorNegocio("Indicá el piso.");
  if (!d.elemento.trim()) throw new ErrorNegocio("Indicá el elemento.");
  if (!Number.isInteger(d.cantidad) || d.cantidad < 1) throw new ErrorNegocio("La cantidad tiene que ser un entero mayor a 0.");
  if (!d.diametroMm || d.diametroMm <= 0) throw new ErrorNegocio("Indicá el diámetro.");
  if (!d.operarios.length) throw new ErrorNegocio("Elegí al menos un operario.");
}

/** Ítem que corresponde por Ø + elemento + espesor (o solo Ø si hay uno solo). */
function autoItem(its: Awaited<ReturnType<typeof itemsCotizados>>, d: DatosRegistro) {
  const mismoD = its.filter((i) => i.diametroMm === d.diametroMm);
  const exacto = mismoD.find((i) => i.elemento?.toLowerCase() === d.elemento.toLowerCase() && i.espesorCm === d.espesorCm);
  return exacto?.id ?? (mismoD.length === 1 ? mismoD[0].id : null);
}

async function presupuestoEnCurso(presupuestoId: string) {
  const [p] = await db.select({ estado: presupuestos.estado, anio: presupuestos.anio, numero: presupuestos.numero }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p || !EN_CURSO.includes(p.estado)) throw new ErrorNegocio("El presupuesto no está en curso: no se pueden cargar registros.");
  return p;
}

/** Alta idempotente por `clientId` (la cola offline puede reintentar). */
export async function registrar(presupuestoId: string, clientId: string, d: DatosRegistro) {
  const [ya] = await db.select({ id: registrosCampo.id }).from(registrosCampo).where(eq(registrosCampo.clientId, clientId));
  if (ya) return { id: ya.id };
  const { usuario } = await acceso(presupuestoId, "campo", "escribir");
  const p = await presupuestoEnCurso(presupuestoId);
  validar(d);
  const its = await itemsCotizados(presupuestoId);
  const itemId = d.itemId && its.some((i) => i.id === d.itemId) ? d.itemId : autoItem(its, d);
  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(registrosCampo)
      .values({ ...campos(d), presupuestoId, itemId, clientId, createdBy: usuario.id })
      .onConflictDoNothing({ target: registrosCampo.clientId })
      .returning({ id: registrosCampo.id });
    if (!r) return null; // otro reintento ganó la carrera
    await tx.insert(registroOperarios).values([...new Set(d.operarios)].map((userId) => ({ registroId: r.id, userId })));
    return r.id;
  });
  if (!id) return { id: (await db.select({ id: registrosCampo.id }).from(registrosCampo).where(eq(registrosCampo.clientId, clientId)))[0].id };
  await auditar({ actorUserId: usuario.id, action: "campo.registrar", entityType: "presupuesto", entityId: presupuestoId, entityLabel: codigo(p) ?? undefined, diff: { registroId: id, ...campos(d) } });
  return { id };
}

const campos = (d: DatosRegistro) => ({
  fecha: d.fecha,
  piso: d.piso.trim().slice(0, 40),
  elemento: d.elemento.trim().slice(0, 40),
  espesorCm: d.espesorCm == null ? null : String(d.espesorCm),
  diametroMm: d.diametroMm == null ? null : String(d.diametroMm),
  cantidad: String(d.cantidad),
  estado: d.estado,
  observacion: d.observacion?.trim().slice(0, 500) || null,
});

/** RF-CMP-05: el autor dentro de las 48 h, o quien tenga la acción con alcance "todos". */
async function modificable(registroId: string, accion: "escribir" | "eliminar") {
  const [r] = await db.select().from(registrosCampo).where(eq(registrosCampo.id, registroId));
  if (!r) throw new ErrorNegocio("El registro no existe.");
  const { usuario } = await acceso(r.presupuestoId, "campo", "leer");
  const todos = alcanceDe(await getPermisos(usuario.id), "campo", accion) === "todos";
  const autorReciente = r.createdBy === usuario.id && Date.now() - r.createdAt.getTime() < 48 * 3_600_000;
  if (!todos && !autorReciente) throw new ErrorNegocio("Solo quien cargó el registro puede modificarlo, dentro de las 48 h.");
  return { r, usuario };
}

export async function editarRegistro(registroId: string, d: DatosRegistro) {
  const { r, usuario } = await modificable(registroId, "escribir");
  validar(d);
  await db.transaction(async (tx) => {
    await tx.update(registrosCampo).set({ ...campos(d), itemId: d.itemId, updatedAt: new Date() }).where(eq(registrosCampo.id, registroId));
    await tx.delete(registroOperarios).where(eq(registroOperarios.registroId, registroId));
    await tx.insert(registroOperarios).values([...new Set(d.operarios)].map((userId) => ({ registroId, userId })));
  });
  await auditar({ actorUserId: usuario.id, action: "campo.editar", entityType: "presupuesto", entityId: r.presupuestoId, diff: { registroId, antes: { piso: r.piso, diametroMm: r.diametroMm, cantidad: r.cantidad }, despues: campos(d) } });
}

export async function eliminarRegistro(registroId: string) {
  const { r, usuario } = await modificable(registroId, "eliminar");
  const fotos = await db.select({ id: archivos.id }).from(archivos).where(and(eq(archivos.entidadTipo, ENTIDAD_FOTO), eq(archivos.entidadId, registroId)));
  for (const f of fotos) await eliminarArchivo(f.id);
  await db.delete(registrosCampo).where(eq(registrosCampo.id, registroId));
  await auditar({ actorUserId: usuario.id, action: "campo.eliminar", entityType: "presupuesto", entityId: r.presupuestoId, diff: { registroId, piso: r.piso, diametroMm: r.diametroMm, cantidad: r.cantidad } });
}

export async function listarRegistros(presupuestoId: string) {
  await acceso(presupuestoId, "campo", "leer");
  const [regs, ops, fotos] = await Promise.all([
    db.select().from(registrosCampo).where(eq(registrosCampo.presupuestoId, presupuestoId)).orderBy(desc(registrosCampo.fecha), desc(registrosCampo.createdAt)),
    db
      .select({ registroId: registroOperarios.registroId, userId: user.id, name: user.name })
      .from(registroOperarios)
      .innerJoin(registrosCampo, eq(registrosCampo.id, registroOperarios.registroId))
      .innerJoin(user, eq(user.id, registroOperarios.userId))
      .where(eq(registrosCampo.presupuestoId, presupuestoId)),
    db
      .select({ id: archivos.id, registroId: archivos.entidadId, tomadaAt: archivos.tomadaAt, createdAt: archivos.createdAt })
      .from(archivos)
      .innerJoin(registrosCampo, sql`${registrosCampo.id}::text = ${archivos.entidadId}`)
      .where(and(eq(registrosCampo.presupuestoId, presupuestoId), eq(archivos.entidadTipo, ENTIDAD_FOTO), eq(archivos.estado, "ok"), isNull(archivos.deletedAt))),
  ]);
  return regs.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    piso: r.piso,
    elemento: r.elemento,
    espesorCm: num(r.espesorCm),
    diametroMm: num(r.diametroMm),
    cantidad: Number(r.cantidad),
    estado: r.estado,
    observacion: r.observacion,
    itemId: r.itemId,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    operarios: ops.filter((o) => o.registroId === r.id).map((o) => ({ id: o.userId, name: o.name })),
    fotos: fotos.filter((f) => f.registroId === r.id).map((f) => ({ id: f.id, tomadaAt: f.tomadaAt ?? f.createdAt })),
  }));
}

/** Balance por diámetro (RF-BAL-01). Sin `ver_montos` no lleva precios. */
export async function balancePresupuesto(presupuestoId: string) {
  const { usuario } = await acceso(presupuestoId, "campo", "leer");
  const verMontos = !!alcanceDe(await getPermisos(usuario.id), "presupuestos", "ver_montos");
  const [its, ejecutados] = await Promise.all([
    itemsCotizados(presupuestoId),
    db
      .select({ diametroMm: registrosCampo.diametroMm, cantidad: sql<string>`sum(${registrosCampo.cantidad})` })
      .from(registrosCampo)
      .where(and(eq(registrosCampo.presupuestoId, presupuestoId), eq(registrosCampo.tipoServicio, "perforacion")))
      .groupBy(registrosCampo.diametroMm),
  ]);
  const b = balance(
    its.filter((i) => i.diametroMm != null).map((i) => ({ diametroMm: i.diametroMm!, cantidad: i.cantidad, precioUnitario: i.precioUnitario })),
    ejecutados.filter((e) => e.diametroMm != null).map((e) => ({ diametroMm: Number(e.diametroMm), cantidad: Number(e.cantidad) })),
  );
  if (!verMontos) for (const f of b.filas) f.precioUnitario = null;
  return { ...b, verMontos };
}

// ── Fotos ─────────────────────────────────────────────────────────────────────

async function registroDe(registroId: string) {
  const [r] = await db.select({ presupuestoId: registrosCampo.presupuestoId }).from(registrosCampo).where(eq(registrosCampo.id, registroId));
  if (!r) throw new ErrorNegocio("El registro no existe.");
  return r;
}

export async function prepararFoto(registroId: string, d: { nombre: string; mime: string; bytes: number; tomadaAt: Date | null }) {
  const r = await registroDe(registroId);
  const { usuario } = await acceso(r.presupuestoId, "campo", "escribir");
  if (!d.mime.startsWith("image/")) throw new ErrorNegocio("Solo se aceptan fotos.");
  return prepararSubida(d.bytes, { nombre: d.nombre.slice(0, 200), mime: d.mime, entidadTipo: ENTIDAD_FOTO, entidadId: registroId, categoria: "foto", createdBy: usuario.id, tomadaAt: d.tomadaAt ?? undefined });
}

export async function confirmarFoto(archivoId: string) {
  const [a] = await db.select().from(archivos).where(and(eq(archivos.id, archivoId), eq(archivos.entidadTipo, ENTIDAD_FOTO)));
  if (!a?.entidadId) throw new ErrorNegocio("La foto no existe.");
  const { usuario } = await acceso((await registroDe(a.entidadId)).presupuestoId, "campo", "escribir");
  if (a.createdBy !== usuario.id) throw new ErrorNegocio("Solo quien subió la foto puede confirmarla.");
  await confirmarSubida(archivoId);
}

export async function urlFoto(archivoId: string) {
  const [a] = await db.select().from(archivos).where(and(eq(archivos.id, archivoId), eq(archivos.entidadTipo, ENTIDAD_FOTO)));
  if (!a?.entidadId) throw new ErrorNegocio("La foto no existe.");
  await acceso((await registroDe(a.entidadId)).presupuestoId, "campo", "leer");
  return urlDescarga(archivoId);
}

/** URLs firmadas de todas las fotos del presupuesto (una verificación de permiso para la galería). */
export async function urlsFotos(presupuestoId: string, ids: string[]) {
  await acceso(presupuestoId, "campo", "leer");
  const propias = new Set(
    (
      await db
        .select({ id: archivos.id })
        .from(archivos)
        .innerJoin(registrosCampo, sql`${registrosCampo.id}::text = ${archivos.entidadId}`)
        .where(and(eq(registrosCampo.presupuestoId, presupuestoId), eq(archivos.entidadTipo, ENTIDAD_FOTO)))
    ).map((a) => a.id),
  );
  return Object.fromEntries(await Promise.all(ids.filter((id) => propias.has(id)).map(async (id) => [id, await urlDescarga(id)] as const)));
}
