import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adicionales, cobros, cobrosEsperados, estadoHistorial, presupuestoRevisiones, presupuestos, user } from "@/db/schema";
import { estadoCobro, importeImputado, porcentaje, porCobrar, type Medio } from "@/domain/cobros";
import { codigoPresupuesto } from "@/domain/codigos";
import type { Moneda, Totales } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { getPermisos, requirePermiso } from "./sesion";

// Cobros (spec/08 §3). Los cobros esperados se generan solos con el workflow; los recibidos se
// imputan a un esperado. El estado (pendiente/parcial/abonado) se calcula, no se guarda.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const cod = (p: { anio: number | null; numero: number | null }) => (p.anio && p.numero ? codigoPresupuesto(p.anio, p.numero) : "sin numerar");

async function presupuestoDe(tx: Tx | typeof db, id: string) {
  const [p] = await tx.select().from(presupuestos).where(eq(presupuestos.id, id));
  if (!p) throw new ErrorNegocio("El presupuesto no existe.");
  return p;
}

/** Total (con IVA si corresponde) de la revisión emitida vigente. */
async function totalVigente(tx: Tx | typeof db, presupuestoId: string) {
  const [rev] = await tx
    .select({ totales: presupuestoRevisiones.totales })
    .from(presupuestoRevisiones)
    .where(and(eq(presupuestoRevisiones.presupuestoId, presupuestoId), eq(presupuestoRevisiones.estado, "emitida")))
    .orderBy(desc(presupuestoRevisiones.nro))
    .limit(1);
  return (rev?.totales as Totales | null)?.total ?? 0;
}

/** Al pasar a En progreso (RF-COB-01). Idempotente: si ya existe, no hace nada. */
export async function generarAnticipo(tx: Tx, presupuestoId: string) {
  const p = await presupuestoDe(tx, presupuestoId);
  const pct = Number(p.anticipoPct);
  if (pct <= 0) return;
  const [ya] = await tx
    .select({ id: cobrosEsperados.id })
    .from(cobrosEsperados)
    .where(and(eq(cobrosEsperados.presupuestoId, presupuestoId), isNull(cobrosEsperados.adicionalId), eq(cobrosEsperados.concepto, "anticipo")));
  if (ya) return;
  await tx.insert(cobrosEsperados).values({
    presupuestoId,
    concepto: "anticipo",
    descripcion: `Anticipo del ${pct}% sobre el presupuesto original (${cod(p)})`,
    importe: String(porcentaje(await totalVigente(tx, presupuestoId), pct)),
    moneda: p.moneda as Moneda,
  });
}

/**
 * Saldo del presupuesto original: total − los demás esperados del presupuesto (anticipo, otros).
 * Se crea al pasar a Pendiente liquidación y se recalcula si se vuelve a llamar.
 * `total` permite usar lo certificado en lugar de lo cotizado (certificación final).
 */
export async function generarSaldo(tx: Tx, presupuestoId: string, total?: number) {
  const p = await presupuestoDe(tx, presupuestoId);
  const propios = await tx
    .select()
    .from(cobrosEsperados)
    .where(and(eq(cobrosEsperados.presupuestoId, presupuestoId), isNull(cobrosEsperados.adicionalId), inArray(cobrosEsperados.concepto, ["anticipo", "saldo"])));
  const base = total ?? (await totalVigente(tx, presupuestoId));
  const otros = propios.filter((e) => e.concepto !== "saldo").reduce((s, e) => s + Number(e.importe), 0);
  const importe = String(Math.max(0, Math.round((base - otros) * 100) / 100));
  const saldo = propios.find((e) => e.concepto === "saldo");
  const pct = 100 - Number(p.anticipoPct);
  const descripcion = `Saldo${pct > 0 && pct < 100 ? ` del ${pct}%` : ""} sobre el presupuesto original (${cod(p)})`;
  if (saldo) await tx.update(cobrosEsperados).set({ importe, descripcion, updatedAt: new Date() }).where(eq(cobrosEsperados.id, saldo.id));
  else await tx.insert(cobrosEsperados).values({ presupuestoId, concepto: "saldo", descripcion, importe, moneda: p.moneda as Moneda });
}

/** Al aprobar un adicional: su anticipo (si tiene) y su saldo (RF-COB-01, RF-ADI-04). */
export async function generarCobrosAdicional(tx: Tx, adicionalId: string) {
  const [a] = await tx.select().from(adicionales).where(eq(adicionales.id, adicionalId));
  const [ya] = await tx.select({ id: cobrosEsperados.id }).from(cobrosEsperados).where(eq(cobrosEsperados.adicionalId, adicionalId));
  if (ya) return;
  const p = await presupuestoDe(tx, a.presupuestoId);
  const total = (a.totales as Totales | null)?.total ?? 0;
  const pct = Number(a.anticipoPct);
  const anticipo = porcentaje(total, pct);
  const etiqueta = `${cod(p)}-AD${a.nro}`;
  const base = { presupuestoId: a.presupuestoId, adicionalId, concepto: "adicional" as const, moneda: a.moneda };
  if (pct > 0) await tx.insert(cobrosEsperados).values({ ...base, descripcion: `Anticipo del ${pct}% del adicional ${etiqueta}`, importe: String(anticipo) });
  await tx.insert(cobrosEsperados).values({
    ...base,
    descripcion: pct > 0 ? `Saldo del adicional ${etiqueta}` : `Trabajos adicionales ${etiqueta}`,
    importe: String(Math.round((total - anticipo) * 100) / 100),
  });
}

/** Esperados con lo imputado y su estado. Sin permisos (lo usan workflow y certificaciones). */
export async function situacionDePagos(presupuestoId: string, tx: Tx | typeof db = db) {
  const esperados = await tx.select().from(cobrosEsperados).where(eq(cobrosEsperados.presupuestoId, presupuestoId)).orderBy(asc(cobrosEsperados.createdAt));
  const recibidos = esperados.length
    ? await tx
        .select({ c: cobros, autor: user.name })
        .from(cobros)
        .leftJoin(user, eq(user.id, cobros.createdBy))
        .where(inArray(cobros.cobroEsperadoId, esperados.map((e) => e.id)))
        .orderBy(desc(cobros.fecha), desc(cobros.createdAt))
    : [];
  const filas = esperados.map((e) => {
    const imputado = recibidos.filter((r) => r.c.cobroEsperadoId === e.id).reduce((s, r) => s + Number(r.c.importeImputado), 0);
    return { id: e.id, adicionalId: e.adicionalId, concepto: e.concepto, descripcion: e.descripcion, moneda: e.moneda, importe: Number(e.importe), imputado, estado: estadoCobro(Number(e.importe), imputado) };
  });
  return {
    esperados: filas,
    recibidos: recibidos.map(({ c, autor }) => ({
      id: c.id,
      cobroEsperadoId: c.cobroEsperadoId,
      fecha: c.fecha,
      importe: Number(c.importe),
      monedaRecibida: c.monedaRecibida,
      tipoCambio: c.tipoCambio == null ? null : Number(c.tipoCambio),
      importeImputado: Number(c.importeImputado),
      medio: c.medio,
      referencia: c.referencia,
      autor,
    })),
    totalEsperado: filas.reduce((s, f) => s + f.importe, 0),
    cobrado: filas.reduce((s, f) => s + f.imputado, 0),
    porCobrar: porCobrar(filas),
  };
}

async function exigirCobros(accion: "leer" | "escribir" | "eliminar") {
  const r = await requirePermiso("cobros", accion);
  if (!alcanceDe(await getPermisos(r.usuario.id), "presupuestos", "ver_montos")) throw new ErrorNegocio("Los cobros tienen importes: necesitás el permiso de ver montos.");
  return r;
}

export async function listarCobros(presupuestoId: string) {
  await exigirCobros("leer");
  return situacionDePagos(presupuestoId);
}

export type DatosCobro = {
  /** null = "otro concepto": se crea un esperado por el mismo importe. */
  cobroEsperadoId: string | null;
  descripcionOtro: string | null;
  fecha: string;
  importe: number;
  monedaRecibida: Moneda;
  tipoCambio: number | null;
  medio: Medio;
  referencia: string | null;
};

/** RF-COB-02/05: registra el cobro y, si salda todo en Pendiente liquidación, pasa a Terminado. */
export async function registrarCobro(presupuestoId: string, d: DatosCobro) {
  const { usuario } = await exigirCobros("escribir");
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe tiene que ser mayor a 0.");
  const p = await presupuestoDe(db, presupuestoId);
  const moneda = p.moneda as Moneda;
  if (d.monedaRecibida !== moneda && !(d.tipoCambio && d.tipoCambio > 0)) throw new ErrorNegocio("Indicá el tipo de cambio (pesos por dólar).");
  const imputado = importeImputado(d.importe, d.monedaRecibida, moneda, d.tipoCambio);

  const terminado = await db.transaction(async (tx) => {
    let esperadoId = d.cobroEsperadoId;
    if (esperadoId) {
      const [e] = await tx.select().from(cobrosEsperados).where(and(eq(cobrosEsperados.id, esperadoId), eq(cobrosEsperados.presupuestoId, presupuestoId)));
      if (!e) throw new ErrorNegocio("El concepto no corresponde al presupuesto.");
    } else {
      if (!d.descripcionOtro?.trim()) throw new ErrorNegocio("Describí el concepto del cobro.");
      [{ id: esperadoId }] = await tx
        .insert(cobrosEsperados)
        .values({ presupuestoId, concepto: "otro", descripcion: d.descripcionOtro.trim().slice(0, 200), importe: String(imputado), moneda })
        .returning({ id: cobrosEsperados.id });
    }
    await tx.insert(cobros).values({
      cobroEsperadoId: esperadoId!,
      fecha: d.fecha,
      importe: String(d.importe),
      monedaRecibida: d.monedaRecibida,
      tipoCambio: d.monedaRecibida === moneda ? null : String(d.tipoCambio),
      importeImputado: String(imputado),
      medio: d.medio,
      referencia: d.referencia?.trim().slice(0, 200) || null,
      createdBy: usuario.id,
    });
    if (p.estado !== "pendiente_liquidacion") return false;
    if ((await situacionDePagos(presupuestoId, tx)).porCobrar > 0) return false;
    await tx.update(presupuestos).set({ estado: "terminado", estadoAnterior: p.estado, updatedAt: new Date() }).where(eq(presupuestos.id, presupuestoId));
    await tx.insert(estadoHistorial).values({ presupuestoId, desde: p.estado, hasta: "terminado", motivo: "Saldo cobrado en su totalidad", userId: usuario.id });
    return true;
  });
  await auditar({ actorUserId: usuario.id, action: "cobro.registrar", entityType: "presupuesto", entityId: presupuestoId, entityLabel: cod(p), diff: { ...d, imputado } });
  if (terminado) await auditar({ actorUserId: usuario.id, source: "system", action: "presupuesto.estado", entityType: "presupuesto", entityId: presupuestoId, entityLabel: cod(p), diff: { estado: [p.estado, "terminado"], motivo: "Saldo cobrado" } });
  return { terminado };
}

export async function eliminarCobro(presupuestoId: string, cobroId: string) {
  const { usuario } = await exigirCobros("eliminar");
  const [c] = await db
    .select({ c: cobros, presupuestoId: cobrosEsperados.presupuestoId })
    .from(cobros)
    .innerJoin(cobrosEsperados, eq(cobrosEsperados.id, cobros.cobroEsperadoId))
    .where(eq(cobros.id, cobroId));
  if (!c || c.presupuestoId !== presupuestoId) throw new ErrorNegocio("El cobro no existe.");
  await db.transaction(async (tx) => {
    await tx.delete(cobros).where(eq(cobros.id, cobroId));
    // Un "otro concepto" sin cobros no tiene sentido: se va con su único cobro.
    const [e] = await tx.select().from(cobrosEsperados).where(and(eq(cobrosEsperados.id, c.c.cobroEsperadoId), eq(cobrosEsperados.concepto, "otro")));
    if (e && !(await tx.select({ id: cobros.id }).from(cobros).where(eq(cobros.cobroEsperadoId, e.id))).length) await tx.delete(cobrosEsperados).where(eq(cobrosEsperados.id, e.id));
  });
  await auditar({ actorUserId: usuario.id, action: "cobro.eliminar", entityType: "presupuesto", entityId: presupuestoId, diff: { fecha: c.c.fecha, importe: c.c.importe, monedaRecibida: c.c.monedaRecibida } });
}

/** Saldo por cobrar (para cerrar sin motivo). */
export async function saldoPendiente(presupuestoId: string) {
  return (await situacionDePagos(presupuestoId)).porCobrar;
}

