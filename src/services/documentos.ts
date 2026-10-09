import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  adicionales,
  clientes,
  directoresObra,
  documentos,
  documentoVersiones,
  items,
  obras,
  presupuestoRevisiones,
  presupuestos,
  user,
  visitas,
} from "@/db/schema";
import * as docAdicional from "@/documents/adicional";
import { BLOQUES, armar, bloquesPorDefecto, type DatosPresupuesto } from "@/documents/presupuesto";
import { renderDocx } from "@/documents/render";
import type { TipoServicio, Unidad } from "@/domain/items";
import { calcularTotales, type Moneda } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { esFinal, type Estado } from "@/domain/workflow";
import { docxToPdf } from "@/lib/pdf";
import { guardarArchivo, urlDescarga } from "./almacenamiento";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { acceso, codigo } from "./presupuesto-acceso";
import { getPermisos } from "./sesion";

// Documento del presupuesto (spec/06): uno por revisión. Borrador con versiones → emitido inmutable.

const num = (s: string | null) => (s == null ? null : Number(s));

/** Datos bloqueados del documento, leídos de la base (nunca editables en el documento). */
async function datosPresupuesto(presupuestoId: string, revisionId: string): Promise<DatosPresupuesto> {
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  const [rev] = await db.select().from(presupuestoRevisiones).where(eq(presupuestoRevisiones.id, revisionId));
  const [cli] = p.clienteId ? await db.select({ n: clientes.razonSocial }).from(clientes).where(eq(clientes.id, p.clienteId)) : [];
  const [obra] = p.obraId
    ? await db.select({ direccion: obras.direccion, director: directoresObra.nombre }).from(obras).leftJoin(directoresObra, eq(directoresObra.id, obras.directorId)).where(eq(obras.id, p.obraId))
    : [];
  const its = await db.select().from(items).where(eq(items.revisionId, revisionId)).orderBy(asc(items.nro));
  const bonificacion = p.bonifTipo && p.bonifValor ? { tipo: p.bonifTipo, valor: Number(p.bonifValor) } : null;
  const lineas = its.map((i) => ({ cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) }));
  const cod = codigo(p);
  return {
    codigo: cod ? (rev.nro ? `${cod} R${rev.nro}` : cod) : "Sin numerar",
    fecha: rev.emitidaAt ?? new Date(),
    moneda: p.moneda as Moneda,
    validezDias: p.validezDias,
    baseAjuste: p.baseAjuste,
    formaContratacion: p.formaContratacion,
    anticipoPct: Number(p.anticipoPct),
    incluyeIva: p.incluyeIva,
    ivaPct: Number(p.ivaPct),
    bonificacion,
    cliente: cli?.n ?? p.contactoNombre ?? "",
    director: obra?.director ?? null,
    direccion: obra?.direccion ?? "",
    items: its.map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      unidad: i.unidad as Unidad,
      precioUnitario: Number(i.precioUnitario),
      tipoServicio: i.tipoServicio as TipoServicio,
      elemento: i.elemento,
      diametroMm: num(i.diametroMm),
      espesorCm: num(i.espesorCm),
    })),
    totales: calcularTotales(lineas, { bonificacion, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) }),
  };
}

const BLOQUES_POR_TIPO = { presupuesto: BLOQUES, adicional: docAdicional.BLOQUES } as const;

/** Datos bloqueados del documento de un trabajo adicional. */
async function datosAdicional(adicionalId: string): Promise<docAdicional.DatosAdicional> {
  const [a] = await db.select().from(adicionales).where(eq(adicionales.id, adicionalId));
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, a.presupuestoId));
  const [cli] = p.clienteId ? await db.select({ n: clientes.razonSocial }).from(clientes).where(eq(clientes.id, p.clienteId)) : [];
  const [obra] = p.obraId
    ? await db.select({ direccion: obras.direccion, director: directoresObra.nombre }).from(obras).leftJoin(directoresObra, eq(directoresObra.id, obras.directorId)).where(eq(obras.id, p.obraId))
    : [];
  const [rev] = await db
    .select({ emitidaAt: presupuestoRevisiones.emitidaAt })
    .from(presupuestoRevisiones)
    .where(and(eq(presupuestoRevisiones.presupuestoId, p.id), eq(presupuestoRevisiones.estado, "emitida")));
  const its = await db.select().from(items).where(eq(items.adicionalId, adicionalId)).orderBy(asc(items.nro));
  // Solo el % se traslada al adicional (un monto fijo es del presupuesto original).
  const bonificacion = a.mantieneBonificacion && p.bonifTipo === "pct" && p.bonifValor ? { tipo: "pct" as const, valor: Number(p.bonifValor) } : null;
  const cod = codigo(p) ?? "Sin numerar";
  return {
    codigo: `${cod}-AD${a.nro}`,
    fecha: a.emitidoAt ?? new Date(),
    moneda: a.moneda as Moneda,
    validezDias: a.validezDias,
    anticipoPct: Number(a.anticipoPct),
    incluyeIva: p.incluyeIva,
    bonificado: !!bonificacion,
    cliente: cli?.n ?? "",
    director: obra?.director ?? null,
    direccion: obra?.direccion ?? "",
    presupuestoCodigo: cod,
    presupuestoFecha: rev?.emitidaAt ?? null,
    items: its.map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      unidad: i.unidad as Unidad,
      precioUnitario: Number(i.precioUnitario),
      tipoServicio: i.tipoServicio as TipoServicio,
      elemento: i.elemento,
      diametroMm: num(i.diametroMm),
      espesorCm: num(i.espesorCm),
    })),
    totales: calcularTotales(
      its.map((i) => ({ cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario) })),
      { bonificacion, incluyeIva: p.incluyeIva, ivaPct: Number(p.ivaPct) },
    ),
  };
}

/** El documento trae precios: además de leer el presupuesto, hay que poder ver montos. */
async function accesoDocumento(presupuestoId: string, accion: "leer" | "escribir") {
  const r = await acceso(presupuestoId, "documentos", accion);
  if (!alcanceDe(await getPermisos(r.usuario.id), "presupuestos", "ver_montos")) {
    throw new ErrorNegocio("El documento incluye precios: necesitás el permiso de ver montos.");
  }
  return r;
}

/** Documento de la revisión actual; si no existe lo crea con los textos por defecto (o los de la revisión anterior). */
export async function documentoActual(presupuestoId: string) {
  const { usuario } = await accesoDocumento(presupuestoId, "leer");
  const [rev] = await db.select().from(presupuestoRevisiones).where(eq(presupuestoRevisiones.presupuestoId, presupuestoId)).orderBy(desc(presupuestoRevisiones.nro)).limit(1);
  if (!rev) throw new ErrorNegocio("El presupuesto no tiene revisiones.");
  let [doc] = await db.select().from(documentos).where(eq(documentos.revisionId, rev.id));
  const datos = await datosPresupuesto(presupuestoId, rev.id);

  if (!doc) {
    // Una revisión nueva arranca con los textos de la anterior; la primera, con los del Word de PAS.
    const [anterior] = await db
      .select({ bloques: documentos.bloques })
      .from(documentos)
      .where(and(eq(documentos.presupuestoId, presupuestoId), ne(documentos.revisionId, rev.id)))
      .orderBy(desc(documentos.createdAt))
      .limit(1);
    const bloques = anterior?.bloques ?? bloquesPorDefecto(datos);
    [doc] = await db
      .insert(documentos)
      .values({ tipo: "presupuesto", presupuestoId, revisionId: rev.id, bloques })
      .onConflictDoNothing()
      .returning();
    doc ??= (await db.select().from(documentos).where(eq(documentos.revisionId, rev.id)))[0];
    await db.insert(documentoVersiones).values({ documentoId: doc.id, nro: 1, bloques, origen: "sistema", userId: usuario.id }).onConflictDoNothing();
  }

  const [p] = await db.select({ estado: presupuestos.estado }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  return {
    doc,
    datos,
    editable: doc.estado === "borrador" && rev.estado === "borrador" && !esFinal(p.estado as Estado),
    defaults: bloquesPorDefecto(datos),
  };
}

/** Documento del adicional; si no existe lo crea con los textos por defecto. */
export async function documentoAdicional(adicionalId: string) {
  const [a] = await db.select().from(adicionales).where(eq(adicionales.id, adicionalId));
  if (!a) throw new ErrorNegocio("El adicional no existe.");
  const { usuario } = await accesoDocumento(a.presupuestoId, "leer");
  const datos = await datosAdicional(adicionalId);
  let [doc] = await db.select().from(documentos).where(eq(documentos.adicionalId, adicionalId));
  if (!doc) {
    const bloques = docAdicional.bloquesPorDefecto(datos);
    [doc] = await db.insert(documentos).values({ tipo: "adicional", presupuestoId: a.presupuestoId, adicionalId, bloques }).onConflictDoNothing().returning();
    doc ??= (await db.select().from(documentos).where(eq(documentos.adicionalId, adicionalId)))[0];
    await db.insert(documentoVersiones).values({ documentoId: doc.id, nro: 1, bloques, origen: "sistema", userId: usuario.id }).onConflictDoNothing();
  }
  return { doc, datos, editable: doc.estado === "borrador" && a.estado === "borrador", defaults: docAdicional.bloquesPorDefecto(datos) };
}

export async function versiones(documentoId: string) {
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, documentoId));
  if (!doc) throw new ErrorNegocio("El documento no existe.");
  await accesoDocumento(doc.presupuestoId, "leer");
  return db
    .select({ nro: documentoVersiones.nro, origen: documentoVersiones.origen, at: documentoVersiones.at, usuario: user.name, bloques: documentoVersiones.bloques })
    .from(documentoVersiones)
    .leftJoin(user, eq(user.id, documentoVersiones.userId))
    .where(eq(documentoVersiones.documentoId, documentoId))
    .orderBy(desc(documentoVersiones.nro));
}

/** Guarda los bloques como una versión nueva (RF-DOC-02). Solo bloques conocidos. */
export async function guardarBloques(documentoId: string, bloques: Record<string, string>, origen: "usuario" | "ia" | "mcp" = "usuario") {
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, documentoId));
  if (!doc) throw new ErrorNegocio("El documento no existe.");
  const { usuario } = await accesoDocumento(doc.presupuestoId, "escribir");
  if (doc.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido: creá una nueva revisión para modificarlo.");
  const defs = BLOQUES_POR_TIPO[doc.tipo];
  const limpios = Object.fromEntries(defs.map((b) => [b.id, (bloques[b.id] ?? doc.bloques[b.id] ?? "").slice(0, 10_000)]));
  if (defs.every((b) => limpios[b.id] === doc.bloques[b.id])) return doc.version;

  const nro = doc.version + 1;
  await db.transaction(async (tx) => {
    await tx.insert(documentoVersiones).values({ documentoId, nro, bloques: limpios, origen, userId: usuario.id });
    await tx.update(documentos).set({ bloques: limpios, version: nro, updatedAt: new Date() }).where(eq(documentos.id, documentoId));
  });
  await auditar({ actorUserId: usuario.id, source: origen === "mcp" ? "mcp" : "ui", action: "documento.guardar", entityType: "documento", entityId: documentoId, diff: { version: nro, origen } });
  return nro;
}

export async function restaurarVersion(documentoId: string, nro: number) {
  const [v] = await db.select().from(documentoVersiones).where(and(eq(documentoVersiones.documentoId, documentoId), eq(documentoVersiones.nro, nro)));
  if (!v) throw new ErrorNegocio("La versión no existe.");
  await guardarBloques(documentoId, v.bloques);
  return v.bloques;
}

const NOMBRE_TIPO = { presupuesto: "Presupuesto", adicional: "Adicional" } as const;
const nombreArchivo = (tipo: keyof typeof NOMBRE_TIPO, cod: string, cliente: string, ext: string) =>
  `PAS - ${NOMBRE_TIPO[tipo]} ${cod.replace(/\//g, "-")} - ${cliente.replace(/[\\/:*?"<>|]/g, "")}.${ext}`;

/** DOCX + PDF → R2 y documento emitido. Si Gotenberg falla, el PDF queda pendiente. */
async function emitirDocumento(doc: typeof documentos.$inferSelect, armado: { codigo: string; cliente: string }, fecha: Date, usuarioId: string) {
  const docx = renderDocx(doc.tipo, armado);
  const meta = { entidadTipo: "documento", entidadId: doc.id, categoria: doc.tipo, createdBy: usuarioId };
  const docxId = await guardarArchivo(docx, {
    ...meta,
    nombre: nombreArchivo(doc.tipo, armado.codigo, armado.cliente, "docx"),
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  let pdfId: string | null = null;
  try {
    pdfId = await guardarArchivo(await docxToPdf(docx), { ...meta, nombre: nombreArchivo(doc.tipo, armado.codigo, armado.cliente, "pdf"), mime: "application/pdf" });
  } catch (e) {
    console.error("[documentos] PDF pendiente:", e);
  }
  await db
    .update(documentos)
    .set({ estado: "emitido", emitidoAt: fecha, emitidoPor: usuarioId, snapshot: armado, docxArchivoId: docxId, pdfArchivoId: pdfId, pdfEstado: pdfId ? "ok" : "pendiente", updatedAt: new Date() })
    .where(eq(documentos.id, doc.id));
}

/** Emisión de un adicional: genera sus archivos con el código definitivo. Devuelve los totales. */
export async function generarArchivosAdicional(adicionalId: string, fecha: Date, usuarioId: string) {
  const { doc } = await documentoAdicional(adicionalId);
  const datos = { ...(await datosAdicional(adicionalId)), fecha };
  await emitirDocumento(doc, docAdicional.armar(datos, doc.bloques), fecha, usuarioId);
  return datos.totales;
}

/**
 * Genera DOCX (+ PDF) de la revisión y los guarda en R2. Se llama al emitir, antes de marcar
 * la revisión como emitida: si no hay cupo de almacenamiento, no se emite.
 * Si Gotenberg falla, queda solo el DOCX y el PDF "pendiente" (se reintenta al descargar).
 */
export async function generarArchivos(presupuestoId: string, revisionId: string, fecha: Date, usuarioId: string) {
  const { doc } = await documentoActual(presupuestoId);
  if (doc.revisionId !== revisionId) throw new ErrorNegocio("El documento no corresponde a la revisión.");
  const datos = { ...(await datosPresupuesto(presupuestoId, revisionId)), fecha };
  await emitirDocumento(doc, armar(datos, doc.bloques), fecha, usuarioId);
}

/** URL firmada de descarga. Si el PDF quedó pendiente, se genera ahora. */
export async function descargar(documentoId: string, formato: "docx" | "pdf") {
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, documentoId));
  if (!doc || doc.estado !== "emitido" || !doc.docxArchivoId) throw new ErrorNegocio("El documento no está emitido.");
  const { usuario } = await accesoDocumento(doc.presupuestoId, "leer");
  if (formato === "docx") return urlDescarga(doc.docxArchivoId);
  if (!doc.pdfArchivoId) {
    const docx = renderDocx(doc.tipo, doc.snapshot as object);
    const snap = doc.snapshot as { codigo: string; cliente: string };
    const pdfId = await guardarArchivo(await docxToPdf(docx), {
      nombre: nombreArchivo(doc.tipo, snap.codigo, snap.cliente, "pdf"),
      mime: "application/pdf",
      entidadTipo: "documento",
      entidadId: doc.id,
      categoria: doc.tipo,
      createdBy: usuario.id,
    });
    await db.update(documentos).set({ pdfArchivoId: pdfId, pdfEstado: "ok" }).where(eq(documentos.id, doc.id));
    return urlDescarga(pdfId);
  }
  return urlDescarga(doc.pdfArchivoId);
}

/** Documentos emitidos del presupuesto (para listar descargas). */
export async function documentosEmitidos(presupuestoId: string) {
  return db
    .select({ id: documentos.id, revisionId: documentos.revisionId, adicionalId: documentos.adicionalId, pdfEstado: documentos.pdfEstado })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.estado, "emitido")));
}

/** Contexto para la IA: lo mismo que ve el usuario en el documento + pedido y notas de visita. */
export async function contextoParaIA(documentoId: string) {
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, documentoId));
  if (!doc) throw new ErrorNegocio("El documento no existe.");
  const { usuario } = await accesoDocumento(doc.presupuestoId, "escribir");
  if (doc.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  const [p] = await db.select({ pedido: presupuestos.pedido }).from(presupuestos).where(eq(presupuestos.id, doc.presupuestoId));
  const notas = await db
    .select({ previas: visitas.notasPrevias, resultado: visitas.notasResultado })
    .from(visitas)
    .where(eq(visitas.presupuestoId, doc.presupuestoId));
  return {
    usuario,
    doc,
    datos: doc.tipo === "adicional" ? await datosAdicional(doc.adicionalId!) : await datosPresupuesto(doc.presupuestoId, doc.revisionId!),
    bloquesDef: BLOQUES_POR_TIPO[doc.tipo],
    pedido: p?.pedido ?? null,
    notasVisita: notas.flatMap((n) => [n.previas, n.resultado]).filter((x): x is string => !!x?.trim()),
  };
}
