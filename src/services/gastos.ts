import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { categoriasGasto, gastos, presupuestos, proveedores, user } from "@/db/schema";
import { codigoPresupuesto } from "@/domain/codigos";
import { aPesos } from "@/domain/stock";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { acceso } from "./presupuesto-acceso";
import { requirePermiso } from "./sesion";

// Gastos (spec/08 §2): egresos que no son stock, de un presupuesto o generales de la empresa.

export type DatosGasto = {
  fecha: string;
  presupuestoId: string | null;
  categoriaId: string;
  descripcion: string;
  importe: number;
  moneda: "ARS" | "USD";
  tipoCambio: number | null;
};

export async function categorias(soloActivas = true) {
  return db.select().from(categoriasGasto).where(soloActivas ? eq(categoriasGasto.activa, true) : undefined).orderBy(asc(categoriasGasto.nombre));
}

/** Permiso según el destino: un presupuesto (alcance asignados vale) o la empresa (alcance todos). */
async function permisoGasto(presupuestoId: string | null, accion: "leer" | "escribir" | "eliminar") {
  if (presupuestoId) return acceso(presupuestoId, "gastos", accion);
  const r = await requirePermiso("gastos", accion);
  if (r.alcance !== "todos") throw new ErrorNegocio("Los gastos generales de la empresa requieren permiso sobre todos los gastos.");
  return r;
}

/** RF-GAS-01/02: alta idempotente por `clientId` (la cola offline de Campo puede reintentar). */
export async function registrarGasto(d: DatosGasto, clientId?: string) {
  if (clientId) {
    const [ya] = await db.select({ id: gastos.id }).from(gastos).where(eq(gastos.clientId, clientId));
    if (ya) return ya.id;
  }
  const { usuario } = await permisoGasto(d.presupuestoId, "escribir");
  if (!(d.importe > 0)) throw new ErrorNegocio("El importe tiene que ser mayor a 0.");
  if (!d.descripcion.trim()) throw new ErrorNegocio("Describí el gasto.");
  if (d.moneda === "USD" && !(d.tipoCambio && d.tipoCambio > 0)) throw new ErrorNegocio("Indicá el tipo de cambio.");
  const [cat] = await db.select().from(categoriasGasto).where(eq(categoriasGasto.id, d.categoriaId));
  if (!cat) throw new ErrorNegocio("Elegí una categoría.");
  if (d.presupuestoId) {
    const [p] = await db.select({ estado: presupuestos.estado }).from(presupuestos).where(eq(presupuestos.id, d.presupuestoId));
    if (!p || ["rechazado", "cancelado"].includes(p.estado)) throw new ErrorNegocio("El presupuesto está cerrado: no se le pueden cargar gastos.");
  }
  const [g] = await db
    .insert(gastos)
    .values({
      fecha: d.fecha,
      presupuestoId: d.presupuestoId,
      categoriaId: d.categoriaId,
      descripcion: d.descripcion.trim().slice(0, 300),
      importe: String(d.importe),
      moneda: d.moneda,
      tipoCambio: d.moneda === "USD" ? String(d.tipoCambio) : null,
      clientId,
      createdBy: usuario.id,
    })
    .onConflictDoNothing({ target: gastos.clientId })
    .returning({ id: gastos.id });
  if (!g) return (await db.select({ id: gastos.id }).from(gastos).where(eq(gastos.clientId, clientId!)))[0].id;
  await auditar({ actorUserId: usuario.id, action: "gasto.registrar", entityType: d.presupuestoId ? "presupuesto" : "gasto", entityId: d.presupuestoId ?? g.id, diff: { ...d, categoria: cat.nombre } });
  return g.id;
}

export async function listarGastos(f: { presupuestoId?: string | null; desde?: string; hasta?: string }) {
  await permisoGasto(f.presupuestoId ?? null, "leer");
  const filas = await db
    .select({ g: gastos, categoria: categoriasGasto.nombre, autor: user.name, proveedor: proveedores.nombre, anio: presupuestos.anio, numero: presupuestos.numero })
    .from(gastos)
    .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
    .leftJoin(user, eq(user.id, gastos.createdBy))
    .leftJoin(proveedores, eq(proveedores.id, gastos.proveedorId))
    .leftJoin(presupuestos, eq(presupuestos.id, gastos.presupuestoId))
    .where(
      and(
        f.presupuestoId === undefined ? undefined : f.presupuestoId ? eq(gastos.presupuestoId, f.presupuestoId) : isNull(gastos.presupuestoId),
        f.desde ? gte(gastos.fecha, f.desde) : undefined,
        f.hasta ? lte(gastos.fecha, f.hasta) : undefined,
      ),
    )
    .orderBy(desc(gastos.fecha), desc(gastos.createdAt));
  return filas.map((x) => ({
    id: x.g.id,
    fecha: x.g.fecha,
    presupuestoId: x.g.presupuestoId,
    obra: x.anio && x.numero ? codigoPresupuesto(x.anio, x.numero) : null,
    categoria: x.categoria,
    descripcion: x.g.descripcion,
    importe: Number(x.g.importe),
    moneda: x.g.moneda,
    tipoCambio: x.g.tipoCambio == null ? null : Number(x.g.tipoCambio),
    importeArs: aPesos(Number(x.g.importe), x.g.moneda, x.g.tipoCambio == null ? null : Number(x.g.tipoCambio)),
    proveedor: x.proveedor,
    autor: x.autor,
    createdBy: x.g.createdBy,
  }));
}

export async function eliminarGasto(id: string) {
  const [g] = await db.select().from(gastos).where(eq(gastos.id, id));
  if (!g) throw new ErrorNegocio("El gasto no existe.");
  const { usuario } = await permisoGasto(g.presupuestoId, "eliminar");
  await db.delete(gastos).where(eq(gastos.id, id));
  await auditar({ actorUserId: usuario.id, action: "gasto.eliminar", entityType: g.presupuestoId ? "presupuesto" : "gasto", entityId: g.presupuestoId ?? id, diff: { fecha: g.fecha, descripcion: g.descripcion, importe: g.importe, moneda: g.moneda } });
}

/** Sin permisos (resumen económico): gastos del presupuesto por categoría, en ARS. */
export async function gastosPorCategoria(presupuestoId: string) {
  return db
    .select({
      categoria: categoriasGasto.nombre,
      ars: sql<string>`coalesce(sum(case when ${gastos.moneda} = 'ARS' then ${gastos.importe} else ${gastos.importe} * ${gastos.tipoCambio} end), 0)`,
    })
    .from(gastos)
    .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
    .where(eq(gastos.presupuestoId, presupuestoId))
    .groupBy(categoriasGasto.nombre);
}

// ── Categorías (Ajustes) ──────────────────────────────────────────────────────

export async function guardarCategoria(id: string | null, nombre: string, activa: boolean) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  if (!nombre.trim()) throw new ErrorNegocio("Indicá el nombre.");
  try {
    if (id) await db.update(categoriasGasto).set({ nombre: nombre.trim(), activa }).where(eq(categoriasGasto.id, id));
    else await db.insert(categoriasGasto).values({ nombre: nombre.trim() });
  } catch {
    throw new ErrorNegocio("Ya existe una categoría con ese nombre.");
  }
  await auditar({ actorUserId: usuario.id, action: "configuracion.categoria_gasto", entityType: "configuracion", entityId: id ?? "nueva", diff: { nombre, activa } });
}
