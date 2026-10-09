import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { adicionales, categoriasGasto, clientes, cobros, cobrosEsperados, compras, gastos, presupuestoRevisiones, presupuestos } from "@/db/schema";
import { codigoPresupuesto } from "@/domain/codigos";
import type { Totales } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { resumenEconomico, tramoAntiguedad, type Resumen } from "@/domain/resumen";
import { situacionDePagos } from "./cobros";
import { ErrorNegocio } from "./errores";
import { gastosPorCategoria } from "./gastos";
import { acceso } from "./presupuesto-acceso";
import { getPermisos, requirePermiso } from "./sesion";
import { costoMaterialesArs } from "./stock";

// Resumen económico por presupuesto y finanzas de la empresa (spec/08 §4).

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Último tipo de cambio usado en el presupuesto (cobros o gastos en otra moneda). */
async function tipoCambioDe(presupuestoId: string) {
  const [c] = await db
    .select({ tc: cobros.tipoCambio })
    .from(cobros)
    .innerJoin(cobrosEsperados, eq(cobrosEsperados.id, cobros.cobroEsperadoId))
    .where(and(eq(cobrosEsperados.presupuestoId, presupuestoId), isNotNull(cobros.tipoCambio)))
    .orderBy(desc(cobros.fecha))
    .limit(1);
  if (c?.tc) return Number(c.tc);
  const [g] = await db.select({ tc: gastos.tipoCambio }).from(gastos).where(and(eq(gastos.presupuestoId, presupuestoId), isNotNull(gastos.tipoCambio))).orderBy(desc(gastos.fecha)).limit(1);
  return g?.tc ? Number(g.tc) : null;
}

/** Sin permisos: calcula el resumen al día. */
async function calcular(presupuestoId: string): Promise<Resumen> {
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  const [rev] = await db
    .select({ totales: presupuestoRevisiones.totales })
    .from(presupuestoRevisiones)
    .where(and(eq(presupuestoRevisiones.presupuestoId, presupuestoId), eq(presupuestoRevisiones.estado, "emitida")))
    .orderBy(desc(presupuestoRevisiones.nro))
    .limit(1);
  const ads = await db.select({ totales: adicionales.totales }).from(adicionales).where(and(eq(adicionales.presupuestoId, presupuestoId), eq(adicionales.estado, "aprobado")));
  const [sit, materialesArs, porCategoria, tipoCambio] = await Promise.all([situacionDePagos(presupuestoId), costoMaterialesArs(presupuestoId), gastosPorCategoria(presupuestoId), tipoCambioDe(presupuestoId)]);
  return resumenEconomico({
    moneda: p.moneda as "ARS" | "USD",
    presupuestado: (rev?.totales as Totales | null)?.total ?? 0,
    adicionales: r2(ads.reduce((s, a) => s + ((a.totales as Totales | null)?.total ?? 0), 0)),
    cobrado: sit.cobrado,
    materialesArs,
    gastosArs: porCategoria.map((g) => ({ categoria: g.categoria, importe: r2(Number(g.ars)) })),
    tipoCambio,
  });
}

/** RF-RES-01: proyectado mientras está en curso; congelado una vez Terminado. */
export async function resumenPresupuesto(presupuestoId: string) {
  const { usuario } = await acceso(presupuestoId, "presupuestos", "leer");
  if (!alcanceDe(await getPermisos(usuario.id), "presupuestos", "ver_montos")) throw new ErrorNegocio("Necesitás el permiso de ver montos.");
  const [p] = await db.select({ resumenFinal: presupuestos.resumenFinal }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (p?.resumenFinal) return { ...(p.resumenFinal as Resumen), congelado: true };
  return { ...(await calcular(presupuestoId)), congelado: false };
}

/** Al pasar a Terminado: guarda el resumen tal como quedó. Al reabrir se borra (vuelve a ser proyectado). */
export async function congelarResumen(presupuestoId: string) {
  await db.update(presupuestos).set({ resumenFinal: await calcular(presupuestoId) }).where(eq(presupuestos.id, presupuestoId));
}

// ── Finanzas de la empresa (RF-RES-03) ────────────────────────────────────────

const mesDe = (fecha: string) => fecha.slice(0, 7);

export async function finanzasEmpresa(desde: string, hasta: string) {
  await requirePermiso("finanzas", "leer");
  const enRango = (col: typeof cobros.fecha | typeof gastos.fecha | typeof compras.fecha) => and(gte(col, desde), lte(col, hasta));

  const [ingresos, gastosRango, comprasRango, pendientes, enCurso] = await Promise.all([
    db
      .select({ fecha: cobros.fecha, importe: cobros.importeImputado, moneda: cobrosEsperados.moneda })
      .from(cobros)
      .innerJoin(cobrosEsperados, eq(cobrosEsperados.id, cobros.cobroEsperadoId))
      .where(enRango(cobros.fecha)),
    db
      .select({ fecha: gastos.fecha, importe: gastos.importe, moneda: gastos.moneda, tc: gastos.tipoCambio, categoria: categoriasGasto.nombre, general: sql<boolean>`${gastos.presupuestoId} is null` })
      .from(gastos)
      .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
      .where(enRango(gastos.fecha)),
    db.select({ fecha: compras.fecha, total: compras.total, moneda: compras.moneda, tc: compras.tipoCambio }).from(compras).where(enRango(compras.fecha)),
    situacionPendiente(),
    db
      .select({ id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero, estado: presupuestos.estado, cliente: clientes.razonSocial })
      .from(presupuestos)
      .leftJoin(clientes, eq(clientes.id, presupuestos.clienteId))
      .where(and(inArray(presupuestos.estado, ["en_progreso", "pendiente_liquidacion", "terminado"]), sql`${presupuestos.deletedAt} is null`)),
  ]);

  const ars = (importe: string, moneda: string, tc: string | null) => (moneda === "ARS" ? Number(importe) : Number(importe) * Number(tc ?? 0));
  const meses: Record<string, { ingresosArs: number; ingresosUsd: number; egresosArs: number }> = {};
  const mes = (f: string) => (meses[mesDe(f)] ??= { ingresosArs: 0, ingresosUsd: 0, egresosArs: 0 });
  for (const i of ingresos) mes(i.fecha)[i.moneda === "USD" ? "ingresosUsd" : "ingresosArs"] += Number(i.importe);
  for (const g of gastosRango) mes(g.fecha).egresosArs += ars(g.importe, g.moneda, g.tc);
  for (const c of comprasRango) mes(c.fecha).egresosArs += ars(c.total, c.moneda, c.tc);
  const porMes = Object.entries(meses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ mes: m, ingresosArs: r2(v.ingresosArs), ingresosUsd: r2(v.ingresosUsd), egresosArs: r2(v.egresosArs) }));
  const suma = (k: "ingresosArs" | "ingresosUsd" | "egresosArs") => r2(porMes.reduce((s, m) => s + m[k], 0));

  const categorias: Record<string, number> = {};
  for (const g of gastosRango) categorias[g.categoria] = (categorias[g.categoria] ?? 0) + ars(g.importe, g.moneda, g.tc);

  // ponytail: un cálculo por presupuesto; con cientos de obras en curso, agregar en SQL.
  const ranking = (
    await Promise.all(
      enCurso.map(async (p) => {
        const [fila] = await db.select({ resumenFinal: presupuestos.resumenFinal }).from(presupuestos).where(eq(presupuestos.id, p.id));
        const r = (fila.resumenFinal as Resumen | null) ?? (await calcular(p.id));
        return { id: p.id, codigo: p.anio && p.numero ? codigoPresupuesto(p.anio, p.numero) : "sin numerar", cliente: p.cliente, estado: p.estado, moneda: r.moneda, totalACobrar: r.ingresos.totalACobrar, resultado: r.resultado, margen: r.margen };
      }),
    )
  ).sort((a, b) => (b.margen ?? -Infinity) - (a.margen ?? -Infinity));

  return {
    porMes,
    totales: { ingresosArs: suma("ingresosArs"), ingresosUsd: suma("ingresosUsd"), egresosArs: suma("egresosArs"), resultadoArs: r2(suma("ingresosArs") - suma("egresosArs")) },
    gastosPorCategoria: Object.entries(categorias)
      .map(([categoria, importe]) => ({ categoria, importe: r2(importe) }))
      .sort((a, b) => b.importe - a.importe),
    ranking,
    pendientes,
  };
}

/** Cobros pendientes por antigüedad (desde que se generó el cobro esperado). */
async function situacionPendiente() {
  const esperados = await db
    .select({ e: cobrosEsperados, anio: presupuestos.anio, numero: presupuestos.numero, imputado: sql<string>`coalesce((select sum(${cobros.importeImputado}) from ${cobros} where ${cobros.cobroEsperadoId} = ${cobrosEsperados.id}), 0)` })
    .from(cobrosEsperados)
    .innerJoin(presupuestos, eq(presupuestos.id, cobrosEsperados.presupuestoId));
  const hoy = Date.now();
  const tramos = { "0-30": { ARS: 0, USD: 0 }, "31-60": { ARS: 0, USD: 0 }, "60+": { ARS: 0, USD: 0 } };
  const detalle: { presupuestoId: string; codigo: string; concepto: string; moneda: "ARS" | "USD"; pendiente: number; dias: number }[] = [];
  for (const x of esperados) {
    const pendiente = r2(Number(x.e.importe) - Number(x.imputado));
    if (pendiente <= 0) continue;
    const dias = Math.floor((hoy - x.e.createdAt.getTime()) / 86_400_000);
    tramos[tramoAntiguedad(dias)][x.e.moneda] += pendiente;
    detalle.push({ presupuestoId: x.e.presupuestoId, codigo: x.anio && x.numero ? codigoPresupuesto(x.anio, x.numero) : "sin numerar", concepto: x.e.descripcion, moneda: x.e.moneda, pendiente, dias });
  }
  return { tramos, detalle: detalle.sort((a, b) => b.dias - a.dias) };
}
