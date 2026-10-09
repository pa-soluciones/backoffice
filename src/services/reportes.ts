import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, documentos, documentoVersiones, jornadaOperarios, jornadas, obras, presupuestos, registroOperarios, registrosCampo, user, type DatosReporteMensual } from "@/db/schema";
import * as doc from "@/documents/reporte";
import { auditar } from "./auditoria";
import { accesoDocumento, emitirDocumento } from "./documentos";
import { ErrorNegocio } from "./errores";
import { acceso } from "./presupuesto-acceso";

// Reporte Mensual Estadístico por obra y período (spec/06 §3.6). Las cifras se precargan con lo
// registrado en campo y las jornadas del mes; se pueden corregir (son declaración de H&S).

type Doc = typeof documentos.$inferSelect;
const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Operarios distintos y días distintos con registros o jornadas en el mes, en todas las obras del presupuesto. */
async function precarga(obraId: string, periodo: string) {
  const ids = (await db.select({ id: presupuestos.id }).from(presupuestos).where(eq(presupuestos.obraId, obraId))).map((p) => p.id);
  if (!ids.length) return { trabajadores: 0, dias: 0 };
  const delMes = (col: typeof registrosCampo.fecha | typeof jornadas.fecha) => sql`to_char(${col}, 'YYYY-MM') = ${periodo}`;
  const [ops1, ops2, dias1, dias2] = await Promise.all([
    db.selectDistinct({ u: registroOperarios.userId }).from(registroOperarios).innerJoin(registrosCampo, eq(registrosCampo.id, registroOperarios.registroId)).where(and(inArray(registrosCampo.presupuestoId, ids), delMes(registrosCampo.fecha))),
    db.selectDistinct({ u: jornadaOperarios.userId }).from(jornadaOperarios).innerJoin(jornadas, eq(jornadas.id, jornadaOperarios.jornadaId)).where(and(inArray(jornadas.presupuestoId, ids), delMes(jornadas.fecha))),
    db.selectDistinct({ f: registrosCampo.fecha }).from(registrosCampo).where(and(inArray(registrosCampo.presupuestoId, ids), delMes(registrosCampo.fecha))),
    db.selectDistinct({ f: jornadas.fecha }).from(jornadas).where(and(inArray(jornadas.presupuestoId, ids), delMes(jornadas.fecha))),
  ]);
  return { trabajadores: new Set([...ops1, ...ops2].map((o) => o.u)).size, dias: new Set([...dias1, ...dias2].map((d) => d.f)).size };
}

async function datosReporte(d: Pick<Doc, "reporte" | "emitidoAt" | "emitidoPor">, responsableId?: string): Promise<doc.DatosReporte> {
  const r = d.reporte!;
  const [o] = await db.select({ direccion: obras.direccion, cliente: clientes.razonSocial }).from(obras).innerJoin(clientes, eq(clientes.id, obras.clienteId)).where(eq(obras.id, r.obraId));
  const respId = d.emitidoPor ?? responsableId;
  const [resp] = respId ? await db.select({ name: user.name }).from(user).where(eq(user.id, respId)) : [];
  return {
    codigo: `${o.direccion} · ${r.periodo}`,
    fecha: d.emitidoAt ?? new Date(),
    cliente: o.cliente,
    direccion: o.direccion,
    periodo: r.periodo,
    trabajadores: r.trabajadores,
    dias: r.dias,
    accidentes: r.accidentes,
    diasPerdidos: r.diasPerdidos,
    responsable: resp?.name ?? "",
  };
}

async function reporteDe(documentoId: string) {
  const [d] = await db.select().from(documentos).where(and(eq(documentos.id, documentoId), eq(documentos.tipo, "reporte")));
  if (!d?.reporte) throw new ErrorNegocio("El reporte no existe.");
  return d;
}

/** Reportes de la obra del presupuesto. */
export async function listarReportes(presupuestoId: string) {
  await accesoDocumento(presupuestoId, "leer", false);
  const [p] = await db.select({ obraId: presupuestos.obraId }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p?.obraId) return [];
  const filas = await db
    .select({ id: documentos.id, presupuestoId: documentos.presupuestoId, estado: documentos.estado, reporte: documentos.reporte, emitidoAt: documentos.emitidoAt })
    .from(documentos)
    .where(and(eq(documentos.tipo, "reporte"), sql`${documentos.reporte}->>'obraId' = ${p.obraId}`))
    .orderBy(desc(sql`${documentos.reporte}->>'periodo'`));
  return filas.map((f) => ({ ...f, periodo: f.reporte!.periodo }));
}

/** Uno por obra y período: si ya existe, devuelve ese. */
export async function crearReporte(presupuestoId: string, periodo: string) {
  const { usuario } = await accesoDocumento(presupuestoId, "escribir", false);
  if (!PERIODO.test(periodo)) throw new ErrorNegocio("Elegí el mes del reporte.");
  const [p] = await db.select({ obraId: presupuestos.obraId }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p?.obraId) throw new ErrorNegocio("El presupuesto no tiene obra.");
  const [ya] = await db
    .select({ id: documentos.id })
    .from(documentos)
    .where(and(eq(documentos.tipo, "reporte"), sql`${documentos.reporte}->>'obraId' = ${p.obraId}`, sql`${documentos.reporte}->>'periodo' = ${periodo}`));
  if (ya) return ya.id;
  const reporte: DatosReporteMensual = { obraId: p.obraId, periodo, accidentes: 0, diasPerdidos: 0, ...(await precarga(p.obraId, periodo)) };
  const datos = await datosReporte({ reporte, emitidoAt: null, emitidoPor: null }, usuario.id);
  const bloques = doc.bloquesPorDefecto(datos);
  const [d] = await db.insert(documentos).values({ tipo: "reporte", presupuestoId, reporte, bloques }).returning();
  await db.insert(documentoVersiones).values({ documentoId: d.id, nro: 1, bloques, origen: "sistema", userId: usuario.id });
  await auditar({ actorUserId: usuario.id, action: "documento.crear_reporte", entityType: "presupuesto", entityId: presupuestoId, entityLabel: datos.codigo });
  return d.id;
}

export async function documentoReporte(documentoId: string) {
  const d = await reporteDe(documentoId);
  const { usuario } = await accesoDocumento(d.presupuestoId, "leer", false);
  const datos = await datosReporte(d, usuario.id);
  return { doc: d, datos, editable: d.estado === "borrador", defaults: doc.bloquesPorDefecto(datos) };
}

export async function fijarCifrasReporte(documentoId: string, c: Pick<DatosReporteMensual, "trabajadores" | "dias" | "accidentes" | "diasPerdidos">) {
  const d = await reporteDe(documentoId);
  const { usuario } = await accesoDocumento(d.presupuestoId, "escribir", false);
  if (d.estado !== "borrador") throw new ErrorNegocio("El reporte ya fue emitido.");
  for (const v of Object.values(c)) if (!Number.isInteger(v) || v < 0) throw new ErrorNegocio("Las cifras tienen que ser enteros no negativos.");
  if (c.dias > 31) throw new ErrorNegocio("Un mes no tiene más de 31 días.");
  const reporte = { ...d.reporte!, ...c };
  await db.update(documentos).set({ reporte, updatedAt: new Date() }).where(eq(documentos.id, documentoId));
  await auditar({ actorUserId: usuario.id, action: "documento.cifras_reporte", entityType: "documento", entityId: documentoId, diff: c });
}

export async function emitirReporte(documentoId: string) {
  const d = await reporteDe(documentoId);
  const { usuario } = await acceso(d.presupuestoId, "documentos", "emitir");
  if (d.estado !== "borrador") throw new ErrorNegocio("El reporte ya fue emitido.");
  const fecha = new Date();
  const datos = { ...(await datosReporte({ ...d, emitidoPor: usuario.id })), fecha };
  await emitirDocumento(d, { ...doc.armar(datos, d.bloques), cliente: datos.cliente }, fecha, usuario.id);
  await auditar({ actorUserId: usuario.id, action: "documento.emitir", entityType: "presupuesto", entityId: d.presupuestoId, entityLabel: datos.codigo, diff: { documentoId } });
  return datos.codigo;
}
