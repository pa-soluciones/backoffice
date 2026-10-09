import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articulos, compras, presupuestos, proveedores, stockMovimientos, user } from "@/db/schema";
import { codigoPresupuesto } from "@/domain/codigos";
import { alcanceDe } from "@/domain/permisos";
import { aPesos, costoPromedio, DEPOSITO, EXTERNOS, validarCierre, type TipoMovimiento } from "@/domain/stock";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { getPermisos, requirePermiso } from "./sesion";

// Stock (spec/08 §1). El saldo por ubicación es la suma de movimientos; el depósito nunca queda
// negativo: cada operación bloquea las filas de los artículos que toca y verifica dentro de la
// transacción.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const n3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** Saldos por artículo en una ubicación. */
async function saldosEn(tx: Tx | typeof db, ubicacion: string, articuloIds?: string[]) {
  const filas = await tx
    .select({
      articuloId: stockMovimientos.articuloId,
      saldo: sql<string>`sum(case when ${stockMovimientos.hacia} = ${ubicacion} then ${stockMovimientos.cantidad} else -${stockMovimientos.cantidad} end)`,
    })
    .from(stockMovimientos)
    .where(and(or(eq(stockMovimientos.hacia, ubicacion), eq(stockMovimientos.desde, ubicacion)), articuloIds ? inArray(stockMovimientos.articuloId, articuloIds) : undefined))
    .groupBy(stockMovimientos.articuloId);
  return Object.fromEntries(filas.map((f) => [f.articuloId, Number(f.saldo)])) as Record<string, number>;
}

/** Bloquea los artículos (orden fijo para no trabarse entre transacciones) y los devuelve. */
async function bloquear(tx: Tx, ids: string[]) {
  const unicos = [...new Set(ids)].sort();
  const filas = await tx.select().from(articulos).where(inArray(articulos.id, unicos)).orderBy(asc(articulos.id)).for("update");
  if (filas.length !== unicos.length) throw new ErrorNegocio("Hay un artículo que no existe.");
  return Object.fromEntries(filas.map((a) => [a.id, a]));
}

async function permisoStock(accion: "leer" | "escribir" | "eliminar") {
  const r = await requirePermiso("stock", accion);
  const verCostos = !!alcanceDe(await getPermisos(r.usuario.id), "stock", "ver_montos");
  return { ...r, verCostos };
}

async function presupuestoEnCurso(tx: Tx | typeof db, presupuestoId: string) {
  const [p] = await tx.select({ estado: presupuestos.estado, anio: presupuestos.anio, numero: presupuestos.numero }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p || p.estado !== "en_progreso") throw new ErrorNegocio("Los materiales se mueven solo con el presupuesto En progreso.");
  return p.anio && p.numero ? codigoPresupuesto(p.anio, p.numero) : "sin numerar";
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export async function listarArticulos(q?: string) {
  const { verCostos } = await permisoStock("leer");
  const filas = await db
    .select()
    .from(articulos)
    .where(and(eq(articulos.activo, true), q?.trim() ? ilike(articulos.nombre, `%${q.trim()}%`) : undefined))
    .orderBy(asc(articulos.categoria), asc(articulos.nombre));
  const deposito = await saldosEn(db, DEPOSITO);
  return filas.map((a) => {
    const stock = deposito[a.id] ?? 0;
    const minimo = a.stockMinimo == null ? null : Number(a.stockMinimo);
    return {
      id: a.id,
      nombre: a.nombre,
      categoria: a.categoria,
      unidad: a.unidad,
      atributos: a.atributos,
      stock,
      minimo,
      bajoMinimo: minimo != null && stock < minimo,
      costo: verCostos ? Number(a.costoPromedioArs) : null,
    };
  });
}

export type DatosArticulo = { nombre: string; categoria: string; unidad: string; atributos: Record<string, string>; stockMinimo: number | null; notas: string | null };

async function insertarArticulo(tx: Tx | typeof db, d: DatosArticulo) {
  if (!d.nombre.trim()) throw new ErrorNegocio("Indicá el nombre del artículo.");
  const [a] = await tx
    .insert(articulos)
    .values({ nombre: d.nombre.trim().slice(0, 120), categoria: d.categoria, unidad: d.unidad, atributos: d.atributos, stockMinimo: d.stockMinimo == null ? null : n3(d.stockMinimo), notas: d.notas })
    .returning();
  return a;
}

export async function crearArticulo(d: DatosArticulo) {
  const { usuario } = await permisoStock("escribir");
  const a = await insertarArticulo(db, d);
  await auditar({ actorUserId: usuario.id, action: "stock.articulo", entityType: "articulo", entityId: a.id, entityLabel: a.nombre, diff: { ...d } });
  return a.id;
}

export async function actualizarArticulo(id: string, d: DatosArticulo) {
  const { usuario } = await permisoStock("escribir");
  await db
    .update(articulos)
    .set({ nombre: d.nombre.trim().slice(0, 120), categoria: d.categoria, unidad: d.unidad, atributos: d.atributos, stockMinimo: d.stockMinimo == null ? null : n3(d.stockMinimo), notas: d.notas })
    .where(eq(articulos.id, id));
  await auditar({ actorUserId: usuario.id, action: "stock.articulo", entityType: "articulo", entityId: id, entityLabel: d.nombre, diff: { ...d } });
}

export async function listarProveedores() {
  await requirePermiso("stock", "leer");
  return db.select({ id: proveedores.id, nombre: proveedores.nombre, cuit: proveedores.cuit }).from(proveedores).orderBy(asc(proveedores.nombre));
}

export async function crearProveedor(tx: Tx | typeof db, d: { nombre: string; cuit?: string | null; telefono?: string | null; email?: string | null }) {
  if (!d.nombre.trim()) throw new ErrorNegocio("Indicá el nombre del proveedor.");
  const [p] = await tx.insert(proveedores).values({ nombre: d.nombre.trim(), cuit: d.cuit || null, telefono: d.telefono || null, email: d.email || null }).returning({ id: proveedores.id });
  return p.id;
}

// ── Compras ───────────────────────────────────────────────────────────────────

export type DatosCompra = {
  fecha: string;
  proveedorId: string | null;
  proveedorNuevo: string | null;
  destinoPresupuestoId: string | null;
  moneda: "ARS" | "USD";
  tipoCambio: number | null;
  lineas: { articuloId: string | null; nuevo: Pick<DatosArticulo, "nombre" | "categoria" | "unidad"> | null; cantidad: number; precioUnitario: number }[];
};

/**
 * RF-COM-01: compra al depósito o directa a la obra. La compra directa entra al depósito
 * (actualiza el costo promedio) y se asigna en el mismo acto al presupuesto.
 * ponytail: la compra directa se valoriza al promedio al consumirse, no a su precio exacto.
 */
export async function registrarCompra(d: DatosCompra) {
  const { usuario } = await permisoStock("escribir");
  if (!d.lineas.length) throw new ErrorNegocio("Agregá al menos un artículo.");
  if (d.moneda === "USD" && !(d.tipoCambio && d.tipoCambio > 0)) throw new ErrorNegocio("Indicá el tipo de cambio de la compra.");
  for (const l of d.lineas) if (!(l.cantidad > 0) || !(l.precioUnitario >= 0)) throw new ErrorNegocio("Cantidades mayores a 0 y precios no negativos.");

  const compraId = await db.transaction(async (tx) => {
    const obra = d.destinoPresupuestoId ? await presupuestoEnCurso(tx, d.destinoPresupuestoId) : null;
    const proveedorId = d.proveedorNuevo?.trim() ? await crearProveedor(tx, { nombre: d.proveedorNuevo }) : d.proveedorId;
    const ids: string[] = [];
    for (const l of d.lineas) ids.push(l.articuloId ?? (await insertarArticulo(tx, { ...l.nuevo!, atributos: {}, stockMinimo: null, notas: null })).id);
    const arts = await bloquear(tx, ids);
    const deposito = await saldosEn(tx, DEPOSITO, ids);
    const total = Math.round(d.lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0) * 100) / 100;
    const [c] = await tx
      .insert(compras)
      .values({ fecha: d.fecha, proveedorId, destinoPresupuestoId: d.destinoPresupuestoId, moneda: d.moneda, tipoCambio: d.moneda === "USD" ? String(d.tipoCambio) : null, total: String(total), createdBy: usuario.id })
      .returning({ id: compras.id });
    for (const [i, l] of d.lineas.entries()) {
      const id = ids[i];
      const precioArs = aPesos(l.precioUnitario, d.moneda, d.tipoCambio);
      const nuevo = costoPromedio(deposito[id] ?? 0, Number(arts[id].costoPromedioArs), l.cantidad, precioArs);
      deposito[id] = (deposito[id] ?? 0) + l.cantidad;
      arts[id].costoPromedioArs = String(nuevo);
      await tx.update(articulos).set({ costoPromedioArs: String(nuevo) }).where(eq(articulos.id, id));
      const base = { articuloId: id, cantidad: n3(l.cantidad), compraId: c.id, fecha: d.fecha, createdBy: usuario.id };
      await tx.insert(stockMovimientos).values({ ...base, tipo: "compra", desde: EXTERNOS.proveedor, hacia: DEPOSITO, costoUnitarioArs: String(precioArs) });
      if (d.destinoPresupuestoId) {
        await tx.insert(stockMovimientos).values({ ...base, tipo: "asignacion", desde: DEPOSITO, hacia: d.destinoPresupuestoId, costoUnitarioArs: String(nuevo), motivo: `Compra directa para ${obra}` });
      }
    }
    return c.id;
  });
  await auditar({ actorUserId: usuario.id, action: "stock.compra", entityType: "compra", entityId: compraId, diff: { ...d } });
  return compraId;
}

// ── Movimientos ───────────────────────────────────────────────────────────────

type Linea = { articuloId: string; cantidad: number };

/** Mueve cantidades verificando el saldo del origen (depósito u obra). */
async function mover(tx: Tx, tipo: TipoMovimiento, lineas: Linea[], desde: string, hacia: string, usuarioId: string, extra: { motivo?: string | null; clientId?: string; fecha?: string } = {}) {
  const ids = lineas.map((l) => l.articuloId);
  const arts = await bloquear(tx, ids);
  const disponibles = desde === EXTERNOS.ajuste ? null : await saldosEn(tx, desde, ids);
  for (const l of lineas) {
    if (!(l.cantidad > 0)) throw new ErrorNegocio("Las cantidades tienen que ser mayores a 0.");
    if (disponibles && l.cantidad > (disponibles[l.articuloId] ?? 0) + 1e-9) {
      throw new ErrorNegocio(`${arts[l.articuloId].nombre}: hay ${disponibles[l.articuloId] ?? 0} ${arts[l.articuloId].unidad} ${desde === DEPOSITO ? "en el depósito" : "en la obra"}.`);
    }
    if (disponibles) disponibles[l.articuloId] = (disponibles[l.articuloId] ?? 0) - l.cantidad;
    await tx.insert(stockMovimientos).values({
      articuloId: l.articuloId,
      tipo,
      cantidad: n3(l.cantidad),
      desde,
      hacia,
      costoUnitarioArs: arts[l.articuloId].costoPromedioArs,
      motivo: extra.motivo?.trim() || null,
      fecha: extra.fecha ?? hoyAR(),
      clientId: lineas.length === 1 ? extra.clientId : undefined,
      createdBy: usuarioId,
    });
  }
}

export async function asignarMateriales(presupuestoId: string, lineas: Linea[]) {
  const { usuario } = await permisoStock("escribir");
  await db.transaction(async (tx) => {
    await presupuestoEnCurso(tx, presupuestoId);
    await mover(tx, "asignacion", lineas, DEPOSITO, presupuestoId, usuario.id);
  });
  await auditar({ actorUserId: usuario.id, action: "stock.asignar", entityType: "presupuesto", entityId: presupuestoId, diff: { lineas } });
}

export async function devolverMateriales(presupuestoId: string, lineas: Linea[], nota: string | null) {
  const { usuario } = await permisoStock("escribir");
  await db.transaction((tx) => mover(tx, "devolucion", lineas, presupuestoId, DEPOSITO, usuario.id, { motivo: nota }));
  await auditar({ actorUserId: usuario.id, action: "stock.devolver", entityType: "presupuesto", entityId: presupuestoId, diff: { lineas, nota } });
}

/** RF-STK-04: consumo en obra. Idempotente por `clientId` (cola offline). */
export async function registrarConsumo(presupuestoId: string, linea: Linea, clientId?: string) {
  if (clientId) {
    const [ya] = await db.select({ id: stockMovimientos.id }).from(stockMovimientos).where(eq(stockMovimientos.clientId, clientId));
    if (ya) return;
  }
  const { usuario } = await permisoStock("escribir");
  await db.transaction(async (tx) => {
    await presupuestoEnCurso(tx, presupuestoId);
    await mover(tx, "consumo", [linea], presupuestoId, EXTERNOS.consumido, usuario.id, { clientId });
  });
  await auditar({ actorUserId: usuario.id, action: "stock.consumo", entityType: "presupuesto", entityId: presupuestoId, diff: { ...linea } });
}

/** Ajuste (±) o baja del depósito, con motivo obligatorio. */
export async function ajustarStock(articuloId: string, tipo: "ajuste" | "baja", cantidad: number, motivo: string) {
  const { usuario } = await permisoStock("escribir");
  if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo.");
  if (tipo === "baja" && cantidad <= 0) throw new ErrorNegocio("La baja tiene que ser una cantidad positiva.");
  await db.transaction(async (tx) => {
    if (tipo === "baja") return mover(tx, "baja", [{ articuloId, cantidad }], DEPOSITO, EXTERNOS.baja, usuario.id, { motivo });
    if (cantidad > 0) return mover(tx, "ajuste", [{ articuloId, cantidad }], EXTERNOS.ajuste, DEPOSITO, usuario.id, { motivo });
    return mover(tx, "ajuste", [{ articuloId, cantidad: -cantidad }], DEPOSITO, EXTERNOS.ajuste, usuario.id, { motivo });
  });
  await auditar({ actorUserId: usuario.id, action: `stock.${tipo}`, entityType: "articulo", entityId: articuloId, diff: { cantidad, motivo } });
}

// ── Materiales del presupuesto ────────────────────────────────────────────────

/** Saldo en obra por artículo + movimientos del presupuesto. */
export async function materialesDelPresupuesto(presupuestoId: string) {
  const { verCostos } = await permisoStock("leer");
  const saldos = await saldosEn(db, presupuestoId);
  const movs = await db
    .select({ m: stockMovimientos, articulo: articulos.nombre, unidad: articulos.unidad, autor: user.name })
    .from(stockMovimientos)
    .innerJoin(articulos, eq(articulos.id, stockMovimientos.articuloId))
    .leftJoin(user, eq(user.id, stockMovimientos.createdBy))
    .where(or(eq(stockMovimientos.desde, presupuestoId), eq(stockMovimientos.hacia, presupuestoId)))
    .orderBy(desc(stockMovimientos.createdAt));
  const nombres = Object.fromEntries(movs.map((x) => [x.m.articuloId, { nombre: x.articulo, unidad: x.unidad }]));
  return {
    enObra: Object.entries(saldos)
      .filter(([, s]) => Math.abs(s) > 1e-9)
      .map(([articuloId, saldo]) => ({ articuloId, saldo, ...nombres[articuloId] })),
    movimientos: movs.map((x) => ({
      id: x.m.id,
      tipo: x.m.tipo,
      articulo: x.articulo,
      unidad: x.unidad,
      cantidad: Number(x.m.cantidad),
      fecha: x.m.fecha,
      motivo: x.m.motivo,
      autor: x.autor,
      costo: verCostos ? Number(x.m.costoUnitarioArs) * Number(x.m.cantidad) : null,
    })),
  };
}

/** Artículos con stock en el depósito (para asignar). */
export async function disponiblesEnDeposito() {
  await permisoStock("leer");
  const saldos = await saldosEn(db, DEPOSITO);
  const ids = Object.keys(saldos).filter((id) => saldos[id] > 0);
  if (!ids.length) return [];
  const arts = await db.select().from(articulos).where(inArray(articulos.id, ids)).orderBy(asc(articulos.nombre));
  return arts.map((a) => ({ id: a.id, nombre: a.nombre, unidad: a.unidad, disponible: saldos[a.id] }));
}

/** RF-STK-05: cierre de materiales. Cada saldo en obra se reparte entre consumido y devuelto. */
export async function cerrarMateriales(presupuestoId: string, lineas: { articuloId: string; consumido: number; devuelto: number; nota: string | null }[]) {
  const { usuario } = await permisoStock("escribir");
  await db.transaction(async (tx) => {
    const saldos = await saldosEn(tx, presupuestoId);
    const pendientes = Object.entries(saldos).filter(([, s]) => Math.abs(s) > 1e-9);
    const arts = pendientes.length ? await bloquear(tx, pendientes.map(([id]) => id)) : {};
    const completas = pendientes.map(([id, saldo]) => {
      const l = lineas.find((x) => x.articuloId === id);
      return { id, articulo: arts[id].nombre, saldo, consumido: l?.consumido ?? 0, devuelto: l?.devuelto ?? 0, nota: l?.nota ?? null };
    });
    const error = validarCierre(completas);
    if (error) throw new ErrorNegocio(error);
    for (const l of completas) {
      if (l.consumido > 0) await mover(tx, "consumo", [{ articuloId: l.id, cantidad: l.consumido }], presupuestoId, EXTERNOS.consumido, usuario.id, { motivo: "Cierre de materiales" });
      if (l.devuelto > 0) await mover(tx, "devolucion", [{ articuloId: l.id, cantidad: l.devuelto }], presupuestoId, DEPOSITO, usuario.id, { motivo: l.nota ? `Cierre: ${l.nota}` : "Cierre de materiales" });
    }
  });
  await auditar({ actorUserId: usuario.id, action: "stock.cierre", entityType: "presupuesto", entityId: presupuestoId, diff: { lineas } });
}

/** Sin permisos (workflow): artículos que todavía tienen saldo en la obra. */
export async function materialesSinCerrar(presupuestoId: string) {
  return Object.values(await saldosEn(db, presupuestoId)).filter((s) => s > 1e-9).length;
}

/** Sin permisos (resumen económico): consumos valorizados del presupuesto, en ARS. */
export async function costoMaterialesArs(presupuestoId: string) {
  const [r] = await db
    .select({ total: sql<string>`coalesce(sum(${stockMovimientos.cantidad} * ${stockMovimientos.costoUnitarioArs}), 0)` })
    .from(stockMovimientos)
    .where(and(eq(stockMovimientos.desde, presupuestoId), eq(stockMovimientos.tipo, "consumo")));
  return Math.round(Number(r.total) * 100) / 100;
}

/** Historial de un artículo (RF-STK-07). */
export async function movimientosArticulo(articuloId: string) {
  const { verCostos } = await permisoStock("leer");
  const filas = await db
    .select({ m: stockMovimientos, autor: user.name, anio: presupuestos.anio, numero: presupuestos.numero })
    .from(stockMovimientos)
    .leftJoin(user, eq(user.id, stockMovimientos.createdBy))
    .leftJoin(presupuestos, sql`${presupuestos.id}::text in (${stockMovimientos.desde}, ${stockMovimientos.hacia})`)
    .where(eq(stockMovimientos.articuloId, articuloId))
    .orderBy(desc(stockMovimientos.createdAt))
    .limit(200);
  return filas.map((f) => ({
    id: f.m.id,
    tipo: f.m.tipo,
    cantidad: Number(f.m.cantidad),
    desde: f.m.desde,
    hacia: f.m.hacia,
    obra: f.anio && f.numero ? codigoPresupuesto(f.anio, f.numero) : null,
    fecha: f.m.fecha,
    motivo: f.m.motivo,
    autor: f.autor,
    costoUnitario: verCostos ? Number(f.m.costoUnitarioArs) : null,
  }));
}

/** Obras En progreso (destino de una compra directa). */
export async function obrasEnCurso() {
  await requirePermiso("stock", "leer");
  const filas = await db
    .select({ id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero })
    .from(presupuestos)
    .where(and(eq(presupuestos.estado, "en_progreso"), sql`${presupuestos.deletedAt} is null`))
    .orderBy(desc(presupuestos.updatedAt));
  return filas.map((f) => ({ id: f.id, nombre: f.anio && f.numero ? codigoPresupuesto(f.anio, f.numero) : "sin numerar" }));
}

export async function obtenerArticulo(id: string) {
  const { verCostos } = await permisoStock("leer");
  const [a] = await db.select().from(articulos).where(eq(articulos.id, id));
  if (!a) throw new ErrorNegocio("El artículo no existe.");
  const deposito = (await saldosEn(db, DEPOSITO, [id]))[id] ?? 0;
  return { ...a, stockMinimo: a.stockMinimo == null ? null : Number(a.stockMinimo), deposito, costo: verCostos ? Number(a.costoPromedioArs) : null };
}
