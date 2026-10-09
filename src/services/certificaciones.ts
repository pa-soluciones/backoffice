import "server-only";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { adicionales, clientes, directoresObra, documentos, documentoVersiones, items, obras, presupuestoRevisiones, presupuestos, type ParametrosCertificacion } from "@/db/schema";
import * as doc from "@/documents/certificacion";
import { calcularTotales, type Moneda } from "@/domain/montos";
import { auditar } from "./auditoria";
import { ejecutadoPorItem } from "./campo";
import { generarSaldo, situacionDePagos } from "./cobros";
import { accesoDocumento, emitirDocumento } from "./documentos";
import { ErrorNegocio } from "./errores";
import { acceso, codigo } from "./presupuesto-acceso";

// Certificaciones (spec/06 §3.3 y §3.4): de obra (-Cn) o de un adicional (-ADn-Cm), parciales o
// finales. Las cantidades por defecto salen de lo ejecutado en campo, con tope en lo cotizado.

type Doc = typeof documentos.$inferSelect;
const EN_CURSO = ["en_progreso", "pendiente_liquidacion", "terminado"];
const r2 = (n: number) => Math.round(n * 100) / 100;

type ItemCert = { id: string; origen: string; descripcion: string; unidad: string; cotizado: number; ejecutado: number | null; cantidad: number; precioUnitario: number };

/** Ítems certificables con su cantidad (parámetro, o ejecutado con tope en lo cotizado, o lo cotizado). */
async function itemsCertificables(presupuestoId: string, p: ParametrosCertificacion) {
  const [rev] = await db
    .select({ id: presupuestoRevisiones.id, emitidaAt: presupuestoRevisiones.emitidaAt })
    .from(presupuestoRevisiones)
    .where(and(eq(presupuestoRevisiones.presupuestoId, presupuestoId), eq(presupuestoRevisiones.estado, "emitida")))
    .orderBy(desc(presupuestoRevisiones.nro))
    .limit(1);
  const aprobados = await db
    .select()
    .from(adicionales)
    .where(and(eq(adicionales.presupuestoId, presupuestoId), eq(adicionales.estado, "aprobado")))
    .orderBy(asc(adicionales.nro));
  const ads = p.adicionalId ? aprobados.filter((a) => a.id === p.adicionalId) : aprobados.filter((a) => !p.adicionales || p.adicionales.includes(a.id));
  const ej = await ejecutadoPorItem(presupuestoId);
  const filtro = p.adicionalId
    ? eq(items.adicionalId, p.adicionalId)
    : or(rev ? eq(items.revisionId, rev.id) : undefined, ads.length ? inArray(items.adicionalId, ads.map((a) => a.id)) : undefined);
  const its = filtro ? await db.select().from(items).where(filtro).orderBy(asc(items.nro)) : [];
  const conCantidad = (i: typeof items.$inferSelect): ItemCert => {
    const cotizado = Number(i.cantidad);
    const ejecutado = ej.hayRegistros && i.tipoServicio === "perforacion" ? (ej.porItem[i.id] ?? 0) : null;
    const porDefecto = ejecutado == null ? cotizado : Math.min(ejecutado, cotizado);
    const a = ads.find((x) => x.id === i.adicionalId);
    return {
      id: i.id,
      origen: a ? `AD${a.nro}` : "Presupuesto",
      descripcion: i.descripcion,
      unidad: i.unidad,
      cotizado,
      ejecutado,
      cantidad: Math.min(cotizado, Math.max(0, p.cantidades[i.id] ?? porDefecto)),
      precioUnitario: Number(i.precioUnitario),
    };
  };
  return { rev, ads, originales: its.filter((i) => i.revisionId).map(conCantidad), deAdicionales: its.filter((i) => i.adicionalId).map(conCantidad) };
}

const parametrosDe = (d: Pick<Doc, "parametros">): ParametrosCertificacion => d.parametros ?? { adicionalId: null, tipo: "parcial", cantidades: {}, adicionales: null };

/** Sin permisos (los verifica quien llama). */
export async function datosCertificacion(d: Pick<Doc, "id" | "presupuestoId" | "nro" | "parametros" | "emitidoAt">): Promise<doc.DatosCertificacion> {
  const prm = parametrosDe(d);
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, d.presupuestoId));
  const [cli] = p.clienteId ? await db.select({ n: clientes.razonSocial }).from(clientes).where(eq(clientes.id, p.clienteId)) : [];
  const [obra] = p.obraId
    ? await db.select({ direccion: obras.direccion, director: directoresObra.nombre }).from(obras).leftJoin(directoresObra, eq(directoresObra.id, obras.directorId)).where(eq(obras.id, p.obraId))
    : [];
  const { rev, ads, originales, deAdicionales } = await itemsCertificables(p.id, prm);
  const cod = codigo(p) ?? "Sin numerar";
  const ad = prm.adicionalId ? ads[0] : null;
  if (prm.adicionalId && !ad) throw new ErrorNegocio("El adicional no está aprobado.");

  const bonifP = p.bonifTipo && p.bonifValor ? { tipo: p.bonifTipo, valor: Number(p.bonifValor) } : null;
  const lineas = (its: ItemCert[], bonificacion: typeof bonifP) => {
    const t = calcularTotales(its.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precioUnitario })), { bonificacion, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) });
    return its.map((i, n) => ({ descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad as doc.LineaCert["unidad"], precioUnitario: t.lineas[n].precioUnitario, subtotal: t.lineas[n].subtotal }));
  };
  const bonifAd = (a: typeof adicionales.$inferSelect) => (a.mantieneBonificacion && p.bonifTipo === "pct" && p.bonifValor ? { tipo: "pct" as const, valor: Number(p.bonifValor) } : null);
  const lineasOriginales = prm.adicionalId ? [] : lineas(originales, bonifP);
  const lineasAds = ads.map((a) => ({ codigo: `${cod}-AD${a.nro}`, lineas: lineas(deAdicionales.filter((i) => i.origen === `AD${a.nro}`), bonifAd(a)) }));

  // Acumulado de certificaciones emitidas antes, del mismo alcance.
  const anteriores = await db
    .select({ id: documentos.id, parametros: documentos.parametros })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, p.id), eq(documentos.tipo, "certificacion"), eq(documentos.estado, "emitido")));
  const certificadoAnterior = r2(anteriores.filter((x) => x.id !== d.id && (x.parametros?.adicionalId ?? null) === prm.adicionalId).reduce((s, x) => s + (x.parametros?.total ?? 0), 0));

  // Situación de pagos: los cobros esperados del alcance; en la de obra, si todavía no existe el
  // saldo (o es la final) se muestra el que resulta de lo certificado.
  const sit = await situacionDePagos(p.id);
  const delAlcance = sit.esperados.filter((e) => (prm.adicionalId ? e.adicionalId === prm.adicionalId : !e.adicionalId || ads.some((a) => a.id === e.adicionalId)));
  const pagos = delAlcance.map((e) => ({ concepto: e.descripcion, estado: e.estado, importe: e.importe, pendiente: r2(Math.max(0, e.importe - e.imputado)), saldo: e.concepto === "saldo", adicionalId: e.adicionalId }));
  if (!prm.adicionalId) {
    const totalOriginales = calcularTotales(originales.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precioUnitario })), { bonificacion: bonifP, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) }).total;
    const otros = delAlcance.filter((e) => !e.adicionalId && e.concepto !== "saldo").reduce((s, e) => s + e.importe, 0);
    const i = pagos.findIndex((x) => x.saldo);
    if (i < 0 || prm.tipo === "final") {
      const importe = r2(Math.max(0, totalOriginales - otros));
      const imputado = i < 0 ? 0 : delAlcance.find((e) => e.concepto === "saldo")!.imputado;
      const fila = { adicionalId: null, concepto: `Saldo${Number(p.anticipoPct) > 0 ? ` del ${100 - Number(p.anticipoPct)}%` : ""} sobre el presupuesto original (${cod})`, estado: imputado >= importe && importe > 0 ? ("abonado" as const) : imputado > 0 ? ("parcial" as const) : ("pendiente" as const), importe, pendiente: r2(Math.max(0, importe - imputado)), saldo: true };
      // Va después de los conceptos del presupuesto original y antes de los adicionales.
      if (i < 0) pagos.splice(pagos.some((x) => x.adicionalId) ? pagos.findIndex((x) => x.adicionalId) : pagos.length, 0, fila);
      else pagos[i] = fila;
    }
  }

  return {
    codigo: prm.adicionalId ? `${cod}-AD${ad!.nro}-C${d.nro}` : `${cod}-C${d.nro}`,
    alcance: prm.adicionalId ? "adicional" : "obra",
    tipo: prm.tipo,
    fecha: d.emitidoAt ?? new Date(),
    moneda: p.moneda as Moneda,
    incluyeIva: p.incluyeIva,
    bonificado: !!bonifP,
    anticipoPct: Number(p.anticipoPct),
    cliente: cli?.n ?? "",
    director: obra?.director ?? null,
    direccion: obra?.direccion ?? "",
    presupuestoCodigo: cod,
    presupuestoFecha: rev?.emitidaAt ?? null,
    originales: lineasOriginales,
    adicionales: lineasAds.filter((a) => a.lineas.length > 0),
    certificadoAnterior,
    pagos: pagos.map((x) => ({ concepto: x.concepto, estado: x.estado, importe: x.importe, pendiente: x.pendiente })),
  };
}

async function certificacionDe(documentoId: string) {
  const [d] = await db.select().from(documentos).where(and(eq(documentos.id, documentoId), eq(documentos.tipo, "certificacion")));
  if (!d) throw new ErrorNegocio("El documento no existe.");
  return d;
}

export async function listarCertificaciones(presupuestoId: string) {
  await accesoDocumento(presupuestoId, "leer");
  const filas = await db
    .select({ id: documentos.id, nro: documentos.nro, estado: documentos.estado, emitidoAt: documentos.emitidoAt, parametros: documentos.parametros })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.tipo, "certificacion")))
    .orderBy(asc(documentos.createdAt));
  return filas.map((f) => ({ id: f.id, nro: f.nro, estado: f.estado, emitidoAt: f.emitidoAt, adicionalId: f.parametros?.adicionalId ?? null, tipo: f.parametros?.tipo ?? "parcial", total: f.parametros?.total ?? null }));
}

/** Nueva certificación en borrador (o el borrador existente del mismo alcance). */
export async function crearCertificacion(presupuestoId: string, adicionalId: string | null) {
  const { usuario } = await accesoDocumento(presupuestoId, "escribir");
  const [p] = await db.select({ estado: presupuestos.estado }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p || !EN_CURSO.includes(p.estado)) throw new ErrorNegocio("Se certifica un presupuesto en curso o terminado.");
  if (adicionalId) {
    const [a] = await db.select({ estado: adicionales.estado }).from(adicionales).where(and(eq(adicionales.id, adicionalId), eq(adicionales.presupuestoId, presupuestoId)));
    if (a?.estado !== "aprobado") throw new ErrorNegocio("Solo se certifican adicionales aprobados.");
  }
  const mismas = (await db.select().from(documentos).where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.tipo, "certificacion")))).filter(
    (d) => (d.parametros?.adicionalId ?? null) === adicionalId,
  );
  const borrador = mismas.find((d) => d.estado === "borrador");
  if (borrador) return borrador.id;
  const nro = Math.max(0, ...mismas.map((d) => d.nro ?? 0)) + 1;
  const parametros: ParametrosCertificacion = { adicionalId, tipo: "parcial", cantidades: {}, adicionales: null };
  const datos = await datosCertificacion({ id: "", presupuestoId, nro, parametros, emitidoAt: null });
  const bloques = doc.bloquesPorDefecto(datos);
  const [d] = await db.insert(documentos).values({ tipo: "certificacion", presupuestoId, nro, parametros, bloques }).returning();
  await db.insert(documentoVersiones).values({ documentoId: d.id, nro: 1, bloques, origen: "sistema", userId: usuario.id });
  await auditar({ actorUserId: usuario.id, action: "documento.crear_certificacion", entityType: "presupuesto", entityId: presupuestoId, entityLabel: datos.codigo });
  return d.id;
}

export async function documentoCertificacion(documentoId: string) {
  const d = await certificacionDe(documentoId);
  await accesoDocumento(d.presupuestoId, "leer");
  const prm = parametrosDe(d);
  const [datos, certificables, aprobados] = await Promise.all([
    datosCertificacion(d),
    itemsCertificables(d.presupuestoId, prm),
    db.select({ id: adicionales.id, nro: adicionales.nro }).from(adicionales).where(and(eq(adicionales.presupuestoId, d.presupuestoId), eq(adicionales.estado, "aprobado"))).orderBy(asc(adicionales.nro)),
  ]);
  return {
    doc: d,
    datos,
    parametros: prm,
    items: [...certificables.originales, ...certificables.deAdicionales],
    adicionalesAprobados: prm.adicionalId ? [] : aprobados.map((a) => ({ id: a.id, codigo: `${datos.presupuestoCodigo}-AD${a.nro}` })),
    editable: d.estado === "borrador",
    defaults: doc.bloquesPorDefecto(datos),
  };
}

/** Tipo, cantidades y adicionales incluidos (RF: una certificación no supera lo cotizado). */
export async function fijarParametrosCertificacion(documentoId: string, cambios: Pick<ParametrosCertificacion, "tipo" | "cantidades" | "adicionales">) {
  const d = await certificacionDe(documentoId);
  const { usuario } = await accesoDocumento(d.presupuestoId, "escribir");
  if (d.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  const prm = { ...parametrosDe(d), ...cambios, adicionales: parametrosDe(d).adicionalId ? null : cambios.adicionales };
  const { originales, deAdicionales } = await itemsCertificables(d.presupuestoId, { ...prm, adicionales: null });
  for (const [id, cant] of Object.entries(prm.cantidades)) {
    const it = [...originales, ...deAdicionales].find((i) => i.id === id);
    if (!it) throw new ErrorNegocio("Hay un ítem que no corresponde a la certificación.");
    if (!(cant >= 0)) throw new ErrorNegocio("Las cantidades no pueden ser negativas.");
    if (cant > it.cotizado) throw new ErrorNegocio(`"${it.descripcion}": no se puede certificar más de lo cotizado (${it.cotizado}). Para el excedente creá un adicional.`);
  }
  await db.update(documentos).set({ parametros: prm, updatedAt: new Date() }).where(eq(documentos.id, documentoId));
  await auditar({ actorUserId: usuario.id, action: "documento.parametros", entityType: "documento", entityId: documentoId, diff: { tipo: prm.tipo, cantidades: prm.cantidades, adicionales: prm.adicionales } });
}

export async function emitirCertificacion(documentoId: string) {
  const d = await certificacionDe(documentoId);
  const { usuario } = await acceso(d.presupuestoId, "documentos", "emitir");
  await accesoDocumento(d.presupuestoId, "leer"); // ver montos
  if (d.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  const fecha = new Date();
  const datos = { ...(await datosCertificacion(d)), fecha };
  const t = doc.totales(datos);
  if (t.total <= 0) throw new ErrorNegocio("No hay nada para certificar.");
  const prm = { ...parametrosDe(d), total: t.total };
  await db.update(documentos).set({ parametros: prm }).where(eq(documentos.id, documentoId));
  await emitirDocumento({ ...d, parametros: prm }, doc.armar(datos, d.bloques), fecha, usuario.id);
  // Certificación final de obra: el saldo a cobrar pasa a ser el de lo certificado (spec/08 RF-COB-01).
  if (prm.tipo === "final" && !prm.adicionalId && datos.originales.length) {
    const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, d.presupuestoId));
    if (["pendiente_liquidacion", "terminado"].includes(p.estado)) {
      const bonif = p.bonifTipo && p.bonifValor ? { tipo: p.bonifTipo, valor: Number(p.bonifValor) } : null;
      const total = calcularTotales(datos.originales.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precioUnitario })), { bonificacion: bonif?.tipo === "monto" ? bonif : null, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) }).total;
      await db.transaction((tx) => generarSaldo(tx, d.presupuestoId, total));
    }
  }
  await auditar({ actorUserId: usuario.id, action: "documento.emitir", entityType: "presupuesto", entityId: d.presupuestoId, entityLabel: datos.codigo, diff: { documentoId, total: t.total, tipo: prm.tipo } });
  return datos.codigo;
}

