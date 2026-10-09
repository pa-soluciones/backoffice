import "server-only";
import { asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { adicionales, documentos, items, presupuestos } from "@/db/schema";
import type { TipoServicio, Unidad } from "@/domain/items";
import { calcularTotales, type Moneda, type Totales } from "@/domain/montos";
import { ESTADOS_ADICIONAL, TRANSICIONES_ADICIONAL, type EstadoAdicional } from "@/domain/adicionales";
import { alcanceDe } from "@/domain/permisos";
import { auditar } from "./auditoria";
import { generarCobrosAdicional } from "./cobros";
import { notificarPresupuesto } from "./notificaciones";
import { generarArchivosAdicional } from "./documentos";
import { ErrorNegocio } from "./errores";
import { acceso, codigo } from "./presupuesto-acceso";
import { filasItems, type ItemEntrada } from "./presupuestos";
import { getPermisos } from "./sesion";

// Trabajos adicionales (spec/05 §4): AD1, AD2… sobre un presupuesto en curso.

const num = (s: string | null) => (s == null ? null : Number(s));

async function cargar(id: string) {
  const [a] = await db.select().from(adicionales).where(eq(adicionales.id, id));
  if (!a) throw new ErrorNegocio("El adicional no existe.");
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, a.presupuestoId));
  return { a, p };
}

function totalesDe(p: typeof presupuestos.$inferSelect, a: typeof adicionales.$inferSelect, its: { cantidad: string; precioUnitario: string }[]): Totales {
  const bonificacion = a.mantieneBonificacion && p.bonifTipo === "pct" && p.bonifValor ? { tipo: "pct" as const, valor: Number(p.bonifValor) } : null;
  return calcularTotales(
    its.map((i) => ({ cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) })),
    { bonificacion, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) },
  );
}

export async function listarAdicionales(presupuestoId: string) {
  const { usuario } = await acceso(presupuestoId, "presupuestos", "leer");
  const verMontos = !!alcanceDe(await getPermisos(usuario.id), "presupuestos", "ver_montos");
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  const lista = await db.select().from(adicionales).where(eq(adicionales.presupuestoId, presupuestoId)).orderBy(asc(adicionales.nro));
  return Promise.all(
    lista.map(async (a) => {
      const its = await db.select({ cantidad: items.cantidad, precioUnitario: items.precioUnitario }).from(items).where(eq(items.adicionalId, a.id));
      const t = (a.totales as Totales | null) ?? totalesDe(p, a, its);
      return { id: a.id, codigo: `${codigo(p) ?? "Sin numerar"}-AD${a.nro}`, estado: a.estado as EstadoAdicional, total: verMontos ? t.neto : null };
    }),
  );
}

/** RF-ADI-01: solo con el presupuesto en curso. */
export async function crearAdicional(presupuestoId: string) {
  const { usuario } = await acceso(presupuestoId, "presupuestos", "escribir");
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!["en_progreso", "pendiente_liquidacion"].includes(p.estado)) {
    throw new ErrorNegocio("Los adicionales se cargan con el presupuesto En progreso o Pendiente liquidación.");
  }
  const id = await db.transaction(async (tx) => {
    const [{ m }] = await tx.select({ m: max(adicionales.nro) }).from(adicionales).where(eq(adicionales.presupuestoId, presupuestoId));
    const [a] = await tx
      .insert(adicionales)
      .values({
        presupuestoId,
        nro: (m ?? 0) + 1,
        moneda: p.moneda,
        mantieneBonificacion: p.bonifTipo === "pct",
        createdBy: usuario.id,
      })
      .returning({ id: adicionales.id, nro: adicionales.nro });
    await tx.update(presupuestos).set({ updatedAt: new Date() }).where(eq(presupuestos.id, presupuestoId));
    return a;
  });
  await auditar({ actorUserId: usuario.id, action: "adicional.crear", entityType: "presupuesto", entityId: presupuestoId, entityLabel: `${codigo(p)}-AD${id.nro}` });
  return id.id;
}

export async function obtenerAdicional(id: string) {
  const { a, p } = await cargar(id);
  const { usuario } = await acceso(p.id, "presupuestos", "leer");
  const verMontos = !!alcanceDe(await getPermisos(usuario.id), "presupuestos", "ver_montos");
  const its = await db.select().from(items).where(eq(items.adicionalId, id)).orderBy(asc(items.nro));
  const [doc] = await db.select({ id: documentos.id, estado: documentos.estado, pdfEstado: documentos.pdfEstado }).from(documentos).where(eq(documentos.adicionalId, id));
  const totales = (a.totales as Totales | null) ?? totalesDe(p, a, its);
  return {
    ...a,
    estado: a.estado as EstadoAdicional,
    anticipoPct: Number(a.anticipoPct),
    codigo: `${codigo(p) ?? "Sin numerar"}-AD${a.nro}`,
    presupuesto: { id: p.id, codigo: codigo(p), estado: p.estado, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct), bonifPct: p.bonifTipo === "pct" ? Number(p.bonifValor) : null },
    moneda: a.moneda as Moneda,
    verMontos,
    items: its.map((i) => ({
      tipoServicio: i.tipoServicio as TipoServicio,
      elemento: i.elemento,
      diametroMm: num(i.diametroMm),
      espesorCm: num(i.espesorCm),
      unidad: i.unidad as Unidad,
      cantidad: Number(i.cantidad),
      precioUnitario: verMontos ? Number(i.precioUnitario) : null,
      descripcion: i.descripcion,
      descripcionManual: i.descripcionManual,
    })),
    totales: verMontos ? totales : null,
    documento: doc ?? null,
  };
}

async function editable(id: string) {
  const { a, p } = await cargar(id);
  const r = await acceso(p.id, "presupuestos", "escribir");
  if (a.estado !== "borrador") throw new ErrorNegocio("El adicional ya fue emitido.");
  if (!alcanceDe(await getPermisos(r.usuario.id), "presupuestos", "ver_montos")) throw new ErrorNegocio("No tenés permiso para ver ni modificar montos.");
  return { a, p, usuario: r.usuario };
}

export async function guardarItemsAdicional(id: string, entrada: ItemEntrada[]) {
  const { a, p, usuario } = await editable(id);
  await db.transaction(async (tx) => {
    await tx.delete(items).where(eq(items.adicionalId, id));
    if (entrada.length) await tx.insert(items).values(filasItems(entrada).map((f) => ({ ...f, adicionalId: id })));
    await tx.update(adicionales).set({ updatedAt: new Date() }).where(eq(adicionales.id, id));
  });
  await auditar({ actorUserId: usuario.id, action: "adicional.items", entityType: "presupuesto", entityId: p.id, entityLabel: `${codigo(p)}-AD${a.nro}`, diff: { items: entrada } });
}

export async function guardarCondicionesAdicional(id: string, d: { validezDias: number; anticipoPct: number; mantieneBonificacion: boolean }) {
  const { a, p, usuario } = await editable(id);
  await db
    .update(adicionales)
    .set({ validezDias: d.validezDias, anticipoPct: String(d.anticipoPct), mantieneBonificacion: d.mantieneBonificacion, updatedAt: new Date() })
    .where(eq(adicionales.id, id));
  await auditar({ actorUserId: usuario.id, action: "adicional.condiciones", entityType: "presupuesto", entityId: p.id, entityLabel: `${codigo(p)}-AD${a.nro}`, diff: d });
}

/** Genera DOCX/PDF y pasa a Enviado (inmutable). */
export async function emitirAdicional(id: string) {
  const { a, p } = await cargar(id);
  const { usuario } = await acceso(p.id, "documentos", "emitir");
  if (a.estado !== "borrador") throw new ErrorNegocio("El adicional ya fue emitido.");
  const [{ n }] = await db.select({ n: max(items.nro) }).from(items).where(eq(items.adicionalId, id));
  if (!n) throw new ErrorNegocio("Agregá al menos un ítem antes de emitir.");
  const fecha = new Date();
  const totales = await generarArchivosAdicional(id, fecha, usuario.id);
  await db.update(adicionales).set({ estado: "enviado", emitidoAt: fecha, totales, updatedAt: new Date() }).where(eq(adicionales.id, id));
  const cod = `${codigo(p)}-AD${a.nro}`;
  await auditar({ actorUserId: usuario.id, action: "adicional.emitir", entityType: "presupuesto", entityId: p.id, entityLabel: cod });
  await notificarPresupuesto(p.id, usuario.id, { tipo: "documento_emitido", titulo: `Se emitió el adicional ${cod}`, link: `/presupuestos/${p.id}/adicionales/${id}` });
  return cod;
}

/** RF-ADI-02. Rechazo y cancelación piden motivo. */
export async function cambiarEstadoAdicional(id: string, hasta: EstadoAdicional, motivo: string | null) {
  const { a, p } = await cargar(id);
  const { usuario } = await acceso(p.id, "presupuestos", "cambiar_estado");
  if (!TRANSICIONES_ADICIONAL[a.estado as EstadoAdicional].includes(hasta)) {
    throw new ErrorNegocio(`No se puede pasar de ${ESTADOS_ADICIONAL[a.estado as EstadoAdicional]} a ${ESTADOS_ADICIONAL[hasta]}.`);
  }
  if ((hasta === "rechazado" || hasta === "cancelado") && !motivo?.trim()) throw new ErrorNegocio("Indicá el motivo.");
  await db.transaction(async (tx) => {
    await tx
      .update(adicionales)
      .set({ estado: hasta, motivo: motivo?.trim() || null, ...(hasta === "aprobado" ? { aprobadoAt: new Date() } : {}), updatedAt: new Date() })
      .where(eq(adicionales.id, id));
    if (hasta === "aprobado") await generarCobrosAdicional(tx, id);
  });
  await auditar({
    actorUserId: usuario.id,
    action: "adicional.estado",
    entityType: "presupuesto",
    entityId: p.id,
    entityLabel: `${codigo(p)}-AD${a.nro}`,
    diff: { estado: [a.estado, hasta], motivo },
  });
}
