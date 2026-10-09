import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientes,
  directoresObra,
  estadoHistorial,
  items,
  obras,
  presupuestoAsignados,
  presupuestoRevisiones,
  presupuestos,
  user,
  visitas,
} from "@/db/schema";
import { codigoPresupuesto, codigoRevision } from "@/domain/codigos";
import { descripcionAuto, type ItemEstructurado, type TipoServicio, type Unidad } from "@/domain/items";
import { calcularTotales, type Bonificacion, type Moneda, type Totales } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { esFinal, validarTransicion, type Estado } from "@/domain/workflow";
import { auditar } from "./auditoria";
import { generarAnticipo, generarSaldo, situacionDePagos } from "./cobros";
import { defaultsPresupuesto, siguienteNumero } from "./configuracion";
import { generarArchivos } from "./documentos";
import { ErrorNegocio } from "./errores";
import { acceso, codigo, soloAsignados } from "./presupuesto-acceso";
import { esAdmin, getPermisos, requirePermiso, type Usuario } from "./sesion";

// Presupuestos (spec/05). Unidad de trabajo y de seguimiento.

const num = (s: string | null) => (s == null ? null : Number(s));
const vivos = isNull(presupuestos.deletedAt);

export { codigo, soloAsignados };

async function puedeVerMontos(u: Usuario) {
  return !!alcanceDe(await getPermisos(u.id), "presupuestos", "ver_montos");
}

async function cargar(id: string) {
  const [p] = await db.select().from(presupuestos).where(and(eq(presupuestos.id, id), vivos));
  if (!p) throw new ErrorNegocio("El presupuesto no existe.");
  return p;
}

const bonificacionDe = (p: typeof presupuestos.$inferSelect): Bonificacion =>
  p.bonifTipo && p.bonifValor ? { tipo: p.bonifTipo, valor: Number(p.bonifValor) } : null;

async function totalesDe(p: typeof presupuestos.$inferSelect, revisionId: string): Promise<Totales> {
  const its = await db.select({ cantidad: items.cantidad, precioUnitario: items.precioUnitario }).from(items).where(eq(items.revisionId, revisionId)).orderBy(asc(items.nro));
  return calcularTotales(
    its.map((i) => ({ cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) })),
    { bonificacion: bonificacionDe(p), incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) },
  );
}

async function ultimaRevision(presupuestoId: string) {
  const [r] = await db.select().from(presupuestoRevisiones).where(eq(presupuestoRevisiones.presupuestoId, presupuestoId)).orderBy(desc(presupuestoRevisiones.nro)).limit(1);
  return r;
}

async function recalcular(p: typeof presupuestos.$inferSelect) {
  const r = await ultimaRevision(p.id);
  if (r?.estado === "borrador") await db.update(presupuestoRevisiones).set({ totales: await totalesDe(p, r.id) }).where(eq(presupuestoRevisiones.id, r.id));
}

function exigirEditable(p: typeof presupuestos.$inferSelect) {
  if (esFinal(p.estado as Estado)) throw new ErrorNegocio("El presupuesto está cerrado.");
}

// ── Listados ──────────────────────────────────────────────────────────────────

export type Filtros = { estado?: Estado; clienteId?: string; obraId?: string; sinCliente?: boolean; bonificado?: boolean };

export async function listarPresupuestos(f: Filtros = {}) {
  const { usuario, alcance } = await requirePermiso("presupuestos", "leer");
  const verMontos = await puedeVerMontos(usuario);
  const ultima = db
    .select({ presupuestoId: presupuestoRevisiones.presupuestoId, totales: presupuestoRevisiones.totales, nro: presupuestoRevisiones.nro })
    .from(presupuestoRevisiones)
    .where(
      eq(
        presupuestoRevisiones.nro,
        sql`(select max(r2.nro) from presupuesto_revisiones r2 where r2.presupuesto_id = ${presupuestoRevisiones.presupuestoId})`,
      ),
    )
    .as("ultima");

  const rows = await db
    .select({
      p: presupuestos,
      cliente: clientes.razonSocial,
      obra: obras.direccion,
      totales: ultima.totales,
    })
    .from(presupuestos)
    .leftJoin(clientes, eq(clientes.id, presupuestos.clienteId))
    .leftJoin(obras, eq(obras.id, presupuestos.obraId))
    .leftJoin(ultima, eq(ultima.presupuestoId, presupuestos.id))
    .where(
      and(
        vivos,
        f.estado ? eq(presupuestos.estado, f.estado) : undefined,
        f.clienteId ? eq(presupuestos.clienteId, f.clienteId) : undefined,
        f.obraId ? eq(presupuestos.obraId, f.obraId) : undefined,
        f.sinCliente ? isNull(presupuestos.clienteId) : undefined,
        f.bonificado ? sql`${presupuestos.bonifTipo} is not null` : undefined,
        alcance === "asignados" ? soloAsignados(usuario.id) : undefined,
      ),
    )
    .orderBy(desc(presupuestos.updatedAt));

  return rows.map(({ p, cliente, obra, totales }) => ({
    id: p.id,
    codigo: codigo(p),
    estado: p.estado as Estado,
    cliente: cliente ?? p.contactoNombre ?? "Sin cliente",
    anonimo: !p.clienteId,
    obra,
    moneda: p.moneda as Moneda,
    bonificado: !!p.bonifTipo,
    total: verMontos ? ((totales as Totales | null)?.total ?? null) : null,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  }));
}

/** Usuarios activos para asignar (no exige permiso de usuarios). */
export async function opcionesUsuarios() {
  await requirePermiso("presupuestos", "leer");
  return db.select({ id: user.id, name: user.name }).from(user).where(eq(user.activo, true)).orderBy(asc(user.name));
}

// ── Detalle ───────────────────────────────────────────────────────────────────

export async function obtenerPresupuesto(id: string) {
  const { usuario } = await acceso(id, "presupuestos", "leer");
  const verMontos = await puedeVerMontos(usuario);
  const p = await cargar(id);

  const [cliente] = p.clienteId ? await db.select().from(clientes).where(eq(clientes.id, p.clienteId)) : [];
  const [obra] = p.obraId
    ? await db.select({ obra: obras, director: directoresObra.nombre }).from(obras).leftJoin(directoresObra, eq(directoresObra.id, obras.directorId)).where(eq(obras.id, p.obraId))
    : [];
  const [revisiones, asignados, historial, vis] = await Promise.all([
    db.select().from(presupuestoRevisiones).where(eq(presupuestoRevisiones.presupuestoId, id)).orderBy(desc(presupuestoRevisiones.nro)),
    db
      .select({ userId: presupuestoAsignados.userId, rol: presupuestoAsignados.rolTrabajo, name: user.name })
      .from(presupuestoAsignados)
      .innerJoin(user, eq(user.id, presupuestoAsignados.userId))
      .where(eq(presupuestoAsignados.presupuestoId, id)),
    db
      .select({ h: estadoHistorial, usuario: user.name })
      .from(estadoHistorial)
      .leftJoin(user, eq(user.id, estadoHistorial.userId))
      .where(eq(estadoHistorial.presupuestoId, id))
      .orderBy(desc(estadoHistorial.at)),
    db.select().from(visitas).where(eq(visitas.presupuestoId, id)).orderBy(desc(visitas.inicio)),
  ]);

  const actual = revisiones[0];
  const its = actual ? await db.select().from(items).where(eq(items.revisionId, actual.id)).orderBy(asc(items.nro)) : [];
  const cod = codigo(p);

  return {
    ...p,
    codigo: cod,
    estado: p.estado as Estado,
    ivaPct: Number(p.ivaPct),
    anticipoPct: Number(p.anticipoPct),
    bonificacion: bonificacionDe(p),
    tipoCambioRef: num(p.tipoCambioRef),
    verMontos,
    cliente: cliente ?? null,
    obra: obra?.obra ?? null,
    director: obra?.director ?? null,
    revisiones: revisiones.map((r) => ({
      id: r.id,
      nro: r.nro,
      codigo: cod ? codigoRevision(cod, r.nro) : `Borrador R${r.nro}`,
      estado: r.estado,
      emitidaAt: r.emitidaAt,
      total: verMontos ? ((r.totales as Totales | null)?.total ?? null) : null,
    })),
    revisionActual: actual ? { id: actual.id, nro: actual.nro, estado: actual.estado } : null,
    items: its.map((i) => ({
      id: i.id,
      nro: i.nro,
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
    totales: verMontos ? ((actual?.totales as Totales | null) ?? null) : null,
    asignados,
    historial: historial.map(({ h, usuario: u }) => ({ ...h, usuario: u })),
    visitas: vis,
  };
}

// ── Alta y edición ────────────────────────────────────────────────────────────

export type DatosProspecto = {
  clienteId: string | null;
  obraId: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
  origen: string | null;
  pedido: string | null;
  requiereVisita: boolean;
  asignados: string[];
};

async function validarClienteObra(clienteId: string | null, obraId: string | null) {
  if (obraId && !clienteId) throw new ErrorNegocio("Elegí el cliente de la obra.");
  if (!obraId) return;
  const [o] = await db.select({ clienteId: obras.clienteId }).from(obras).where(and(eq(obras.id, obraId), isNull(obras.deletedAt)));
  if (!o || o.clienteId !== clienteId) throw new ErrorNegocio("La obra no pertenece a ese cliente.");
}

export async function crearPresupuesto(d: DatosProspecto) {
  const { usuario } = await requirePermiso("presupuestos", "escribir");
  await validarClienteObra(d.clienteId, d.obraId);
  if (!d.clienteId && !d.contactoNombre && !d.contactoTelefono) {
    throw new ErrorNegocio("Indicá un cliente o al menos un contacto (nombre o teléfono).");
  }
  const def = await defaultsPresupuesto();

  const p = await db.transaction(async (tx) => {
    // RF-NUM-03: con cliente se numera al crear; anónimo, al asociar cliente o emitir.
    const numeracion = d.clienteId ? await siguienteNumero(tx) : { anio: null, numero: null };
    const [p] = await tx
      .insert(presupuestos)
      .values({
        ...numeracion,
        clienteId: d.clienteId,
        obraId: d.obraId,
        contactoNombre: d.contactoNombre,
        contactoTelefono: d.contactoTelefono,
        contactoEmail: d.contactoEmail,
        origen: d.origen,
        pedido: d.pedido,
        requiereVisita: d.requiereVisita,
        validezDias: def.validezDias,
        anticipoPct: String(def.anticipoPct),
        ivaPct: String(def.ivaPct),
        formaContratacion: def.formaContratacion,
        baseAjuste: def.baseAjuste,
        createdBy: usuario.id,
      })
      .returning();
    await tx.insert(presupuestoRevisiones).values({ presupuestoId: p.id, nro: 0 });
    await tx.insert(estadoHistorial).values({ presupuestoId: p.id, hasta: "prospecto", userId: usuario.id });
    if (d.asignados.length) await tx.insert(presupuestoAsignados).values(d.asignados.map((userId) => ({ presupuestoId: p.id, userId })));
    return p;
  });
  await auditar({ actorUserId: usuario.id, action: "presupuesto.crear", entityType: "presupuesto", entityId: p.id, entityLabel: codigo(p) ?? "sin numerar", diff: d });
  return p.id;
}

export async function actualizarProspecto(id: string, d: DatosProspecto) {
  const { usuario } = await acceso(id, "presupuestos", "escribir");
  const p = await cargar(id);
  exigirEditable(p);
  await validarClienteObra(d.clienteId, d.obraId);
  if (p.clienteId && !d.clienteId) throw new ErrorNegocio("No se puede quitar el cliente de un presupuesto.");

  await db.transaction(async (tx) => {
    const numeracion = !p.numero && d.clienteId ? await siguienteNumero(tx) : {};
    await tx
      .update(presupuestos)
      .set({
        ...numeracion,
        clienteId: d.clienteId,
        obraId: d.obraId,
        contactoNombre: d.contactoNombre,
        contactoTelefono: d.contactoTelefono,
        contactoEmail: d.contactoEmail,
        origen: d.origen,
        pedido: d.pedido,
        requiereVisita: d.requiereVisita,
        updatedAt: new Date(),
      })
      .where(eq(presupuestos.id, id));
    await tx.delete(presupuestoAsignados).where(eq(presupuestoAsignados.presupuestoId, id));
    if (d.asignados.length) await tx.insert(presupuestoAsignados).values(d.asignados.map((userId) => ({ presupuestoId: id, userId })));
  });
  await auditar({ actorUserId: usuario.id, action: "presupuesto.actualizar", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: d });
}

export type DatosComerciales = {
  moneda: Moneda;
  tipoCambioRef: number | null;
  incluyeIva: boolean;
  ivaPct: number;
  validezDias: number;
  formaContratacion: string;
  baseAjuste: string;
  anticipoPct: number;
  bonificacion: Bonificacion;
};

/** Solo con la última revisión en borrador: lo emitido no cambia (RF-REV-01, RF-WF-06). */
async function borradorActual(p: typeof presupuestos.$inferSelect) {
  const r = await ultimaRevision(p.id);
  if (r?.estado !== "borrador") throw new ErrorNegocio("El presupuesto ya está emitido: creá una nueva revisión para modificarlo.");
  return r;
}

export async function guardarComerciales(id: string, d: DatosComerciales) {
  const { usuario } = await acceso(id, "presupuestos", "escribir");
  const p = await cargar(id);
  exigirEditable(p);
  await borradorActual(p);
  if (!(await puedeVerMontos(usuario))) throw new ErrorNegocio("No tenés permiso para ver ni modificar montos.");
  const [actualizado] = await db
    .update(presupuestos)
    .set({
      moneda: d.moneda,
      tipoCambioRef: d.tipoCambioRef == null ? null : String(d.tipoCambioRef),
      incluyeIva: d.incluyeIva,
      ivaPct: String(d.ivaPct),
      validezDias: d.validezDias,
      formaContratacion: d.formaContratacion,
      baseAjuste: d.baseAjuste,
      anticipoPct: String(d.anticipoPct),
      bonifTipo: d.bonificacion?.tipo ?? null,
      bonifValor: d.bonificacion ? String(d.bonificacion.valor) : null,
      updatedAt: new Date(),
    })
    .where(eq(presupuestos.id, id))
    .returning();
  await recalcular(actualizado);
  await auditar({ actorUserId: usuario.id, action: "presupuesto.comerciales", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: d });
}

export type ItemEntrada = ItemEstructurado & { cantidad: number; precioUnitario: number; descripcion: string | null };

/** Filas de ítems listas para insertar (sin dueño): descripción automática salvo que la editen. */
export function filasItems(entrada: ItemEntrada[]) {
  return entrada.map((it, i) => {
    const auto = descripcionAuto(it);
    const manual = !!it.descripcion?.trim() && it.descripcion.trim() !== auto;
    return {
      nro: i + 1,
      tipoServicio: it.tipoServicio,
      elemento: it.elemento,
      diametroMm: it.diametroMm == null ? null : String(it.diametroMm),
      espesorCm: it.espesorCm == null ? null : String(it.espesorCm),
      unidad: it.unidad,
      cantidad: String(it.cantidad),
      precioUnitario: String(it.precioUnitario),
      descripcion: manual ? it.descripcion!.trim() : auto,
      descripcionManual: manual,
    };
  });
}

export async function guardarItems(id: string, entrada: ItemEntrada[]) {
  const { usuario } = await acceso(id, "presupuestos", "escribir");
  const p = await cargar(id);
  exigirEditable(p);
  const r = await borradorActual(p);
  if (!(await puedeVerMontos(usuario))) throw new ErrorNegocio("No tenés permiso para ver ni modificar montos.");

  await db.transaction(async (tx) => {
    await tx.delete(items).where(eq(items.revisionId, r.id));
    if (entrada.length)
      await tx.insert(items).values(
        filasItems(entrada).map((f) => ({ ...f, revisionId: r.id })),
      );
    await tx.update(presupuestos).set({ updatedAt: new Date() }).where(eq(presupuestos.id, id));
  });
  await recalcular(p);
  await auditar({ actorUserId: usuario.id, action: "presupuesto.items", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: { items: entrada } });
}

// ── Revisiones ────────────────────────────────────────────────────────────────

/**
 * Emite la revisión en borrador: numera (si hace falta), genera DOCX/PDF y la deja inmutable
 * con sus totales congelados. Si no se pueden guardar los archivos, no se emite.
 */
export async function emitirRevision(id: string) {
  const { usuario } = await acceso(id, "documentos", "emitir");
  const p = await cargar(id);
  exigirEditable(p);
  const r = await borradorActual(p);
  if (!p.clienteId || !p.obraId) throw new ErrorNegocio("Para emitir, el presupuesto necesita cliente y obra.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(items).where(eq(items.revisionId, r.id));
  if (!n) throw new ErrorNegocio("Agregá al menos un ítem antes de emitir.");

  // 1) Numerar (un número nunca se reutiliza, aunque después falle la emisión).
  const numerado = p.numero
    ? { anio: p.anio!, numero: p.numero }
    : await db.transaction(async (tx) => {
        const n = await siguienteNumero(tx);
        await tx.update(presupuestos).set(n).where(eq(presupuestos.id, id));
        return n;
      });
  // 2) Generar y guardar los archivos (pasa por la guarda de R2).
  const fecha = new Date();
  await generarArchivos(id, r.id, fecha, usuario.id);
  // 3) Marcar la revisión como emitida.
  await db.transaction(async (tx) => {
    await tx.update(presupuestoRevisiones).set({ estado: "reemplazada" }).where(and(eq(presupuestoRevisiones.presupuestoId, id), eq(presupuestoRevisiones.estado, "emitida")));
    await tx
      .update(presupuestoRevisiones)
      .set({ estado: "emitida", emitidaAt: fecha, emitidaPor: usuario.id, totales: await totalesDe(p, r.id) })
      .where(eq(presupuestoRevisiones.id, r.id));
    await tx.update(presupuestos).set({ updatedAt: new Date() }).where(eq(presupuestos.id, id));
  });
  const cod = codigoRevision(codigoPresupuesto(numerado.anio, numerado.numero), r.nro);
  await auditar({ actorUserId: usuario.id, action: "presupuesto.emitir", entityType: "presupuesto", entityId: id, entityLabel: cod });
  return cod;
}

/** RF-REV-01: copia ítems de la última emitida a un borrador nuevo R(n+1). */
export async function nuevaRevision(id: string) {
  const { usuario } = await acceso(id, "presupuestos", "escribir");
  const p = await cargar(id);
  exigirEditable(p);
  const ultima = await ultimaRevision(id);
  if (!ultima || ultima.estado === "borrador") throw new ErrorNegocio("Ya hay una revisión en borrador.");
  await db.transaction(async (tx) => {
    const [nueva] = await tx.insert(presupuestoRevisiones).values({ presupuestoId: id, nro: ultima.nro + 1, totales: ultima.totales }).returning();
    const its = await tx.select().from(items).where(eq(items.revisionId, ultima.id));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se descarta el id para que la copia genere uno nuevo
    if (its.length) await tx.insert(items).values(its.map(({ id: _id, ...i }) => ({ ...i, revisionId: nueva.id })));
    await tx.update(presupuestos).set({ updatedAt: new Date() }).where(eq(presupuestos.id, id));
  });
  await auditar({ actorUserId: usuario.id, action: "presupuesto.nueva_revision", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: { nro: ultima.nro + 1 } });
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export async function cambiarEstado(id: string, hasta: Estado, datos: { motivo?: string | null; fechaConfirmacion?: string | null }) {
  const { usuario } = await acceso(id, "presupuestos", "cambiar_estado");
  const p = await cargar(id);
  const desde = p.estado as Estado;
  const [emitidas, resueltas] = await Promise.all([
    db.select({ x: presupuestoRevisiones.id }).from(presupuestoRevisiones).where(and(eq(presupuestoRevisiones.presupuestoId, id), ne(presupuestoRevisiones.estado, "borrador"))).limit(1),
    db.select({ x: visitas.id }).from(visitas).where(and(eq(visitas.presupuestoId, id), inArray(visitas.estado, ["realizada", "omitida"]))).limit(1),
  ]);
  const error = validarTransicion(desde, hasta, {
    requiereVisita: p.requiereVisita,
    visitaResuelta: resueltas.length > 0,
    tieneEmitida: emitidas.length > 0,
    fechaConfirmacion: datos.fechaConfirmacion,
    motivo: datos.motivo,
    saldoPendiente: hasta === "terminado" ? (await situacionDePagos(id)).porCobrar : 0,
  });
  if (error) throw new ErrorNegocio(error);

  await db.transaction(async (tx) => {
    await tx
      .update(presupuestos)
      .set({
        estado: hasta,
        estadoAnterior: desde,
        updatedAt: new Date(),
        ...(hasta === "en_progreso" ? { fechaConfirmacion: datos.fechaConfirmacion } : {}),
        ...(datos.motivo && esFinal(hasta) ? { motivoCierre: datos.motivo } : {}),
      })
      .where(eq(presupuestos.id, id));
    await tx.insert(estadoHistorial).values({ presupuestoId: id, desde, hasta, motivo: datos.motivo ?? (datos.fechaConfirmacion ? `Confirmado el ${datos.fechaConfirmacion}` : null), userId: usuario.id });
    // Cobros esperados (spec/08 RF-COB-01).
    if (hasta === "en_progreso") await generarAnticipo(tx, id);
    if (hasta === "pendiente_liquidacion") await generarSaldo(tx, id);
  });
  await auditar({ actorUserId: usuario.id, action: "presupuesto.estado", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: { estado: [desde, hasta], ...datos } });
}

/** RF-WF-03: solo admin reabre un presupuesto cerrado, volviendo al estado anterior. */
export async function reabrir(id: string, motivo: string) {
  const { usuario } = await acceso(id, "presupuestos", "cambiar_estado");
  if (!(await esAdmin(usuario.id))) throw new ErrorNegocio("Solo un administrador puede reabrir un presupuesto.");
  if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo.");
  const p = await cargar(id);
  if (!esFinal(p.estado as Estado) || !p.estadoAnterior) throw new ErrorNegocio("El presupuesto no está cerrado.");
  await db.transaction(async (tx) => {
    await tx.update(presupuestos).set({ estado: p.estadoAnterior!, estadoAnterior: p.estado, motivoCierre: null, updatedAt: new Date() }).where(eq(presupuestos.id, id));
    await tx.insert(estadoHistorial).values({ presupuestoId: id, desde: p.estado, hasta: p.estadoAnterior!, motivo: `Reabierto: ${motivo}`, userId: usuario.id });
  });
  await auditar({ actorUserId: usuario.id, action: "presupuesto.reabrir", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined, diff: { motivo } });
}

export async function eliminarPresupuesto(id: string) {
  const { usuario } = await acceso(id, "presupuestos", "eliminar");
  const p = await cargar(id);
  const [emitida] = await db.select({ x: presupuestoRevisiones.id }).from(presupuestoRevisiones).where(and(eq(presupuestoRevisiones.presupuestoId, id), ne(presupuestoRevisiones.estado, "borrador"))).limit(1);
  if (emitida) throw new ErrorNegocio("Ya tiene un presupuesto emitido: cancelalo en lugar de eliminarlo.");
  await db.update(presupuestos).set({ deletedAt: new Date() }).where(eq(presupuestos.id, id));
  await auditar({ actorUserId: usuario.id, action: "presupuesto.eliminar", entityType: "presupuesto", entityId: id, entityLabel: codigo(p) ?? undefined });
}


/** Clientes activos con sus obras, para el formulario de prospecto. */
export async function opcionesClientesObras() {
  await requirePermiso("presupuestos", "escribir");
  const [cs, os] = await Promise.all([
    db.select({ id: clientes.id, razonSocial: clientes.razonSocial }).from(clientes).where(and(isNull(clientes.deletedAt), eq(clientes.archivado, false))).orderBy(asc(clientes.razonSocial)),
    db.select({ id: obras.id, clienteId: obras.clienteId, direccion: obras.direccion }).from(obras).where(isNull(obras.deletedAt)).orderBy(asc(obras.direccion)),
  ]);
  return cs.map((c) => ({ ...c, obras: os.filter((o) => o.clienteId === c.id) }));
}
