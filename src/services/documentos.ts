import "server-only";
import { and, asc, desc, eq, max, ne } from "drizzle-orm";
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
import * as docCertificacion from "@/documents/certificacion";
import * as docControl from "@/documents/control";
import * as docReporte from "@/documents/reporte";
import { BLOQUES, armar, bloquesPorDefecto, type DatosPresupuesto } from "@/documents/presupuesto";
import { renderDocx } from "@/documents/render";
import { rangoPisos } from "@/domain/balance";
import { UNIDADES, type TipoServicio, type Unidad } from "@/domain/items";
import { calcularTotales, formatearMonto, type Moneda } from "@/domain/montos";
import { alcanceDe } from "@/domain/permisos";
import { esFinal, type Estado } from "@/domain/workflow";
import { docxToPdf } from "@/lib/pdf";
import { guardarArchivo, leerArchivo, urlDescarga } from "./almacenamiento";
import { firmaParaDocumento } from "./firma";
import { auditar } from "./auditoria";
import { datosCampo } from "./campo";
import { notificarPresupuesto } from "./notificaciones";
import { datosCertificacion } from "./certificaciones";
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

const BLOQUES_POR_TIPO = { presupuesto: BLOQUES, adicional: docAdicional.BLOQUES, control: docControl.BLOQUES, certificacion: docCertificacion.BLOQUES, reporte: docReporte.BLOQUES } as const;
/** El control y el reporte mensual no muestran precios: no exigen "ver montos". */
const conMontos = (tipo: keyof typeof BLOQUES_POR_TIPO) => tipo !== "control" && tipo !== "reporte";

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
export async function accesoDocumento(presupuestoId: string, accion: "leer" | "escribir", conMontos = true) {
  const r = await acceso(presupuestoId, "documentos", accion);
  if (conMontos && !alcanceDe(await getPermisos(r.usuario.id), "presupuestos", "ver_montos")) {
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
  await accesoDocumento(doc.presupuestoId, "leer", conMontos(doc.tipo));
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
  const { usuario } = await accesoDocumento(doc.presupuestoId, "escribir", conMontos(doc.tipo));
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

const NOMBRE_TIPO = { presupuesto: "Presupuesto", adicional: "Adicional", control: "Control de perforaciones", certificacion: "Certificación", reporte: "Reporte mensual" } as const;
const nombreArchivo = (tipo: keyof typeof NOMBRE_TIPO, cod: string, cliente: string, ext: string) =>
  `PAS - ${NOMBRE_TIPO[tipo]} ${cod.replace(/\//g, "-")} - ${cliente.replace(/[\\/:*?"<>|]/g, "")}.${ext}`;

/** DOCX + PDF → R2 y documento emitido. Si Gotenberg falla, el PDF queda pendiente. */
export async function emitirDocumento(doc: typeof documentos.$inferSelect, armado: { codigo: string; cliente: string }, fecha: Date, usuarioId: string) {
  // Control y reporte se firman en papel (operador, inspección, H&S): sin la imagen de firma de la empresa.
  const docx = renderDocx(doc.tipo, armado, conMontos(doc.tipo) ? await firmaParaDocumento() : null);
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
  const { usuario } = await accesoDocumento(doc.presupuestoId, "leer", conMontos(doc.tipo));
  if (formato === "docx") return urlDescarga(doc.docxArchivoId);
  if (!doc.pdfArchivoId) {
    const docx = await leerArchivo(doc.docxArchivoId); // el emitido, con la firma de ese momento
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
  const { usuario } = await accesoDocumento(doc.presupuestoId, "escribir", conMontos(doc.tipo));
  if (doc.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  return { usuario, doc, bloquesDef: BLOQUES_POR_TIPO[doc.tipo], resumen: await resumenParaIA(doc) };
}

/** Datos del documento en texto, para el pedido a la IA. */
async function resumenParaIA(doc: typeof documentos.$inferSelect) {
  if (doc.tipo === "reporte") {
    const r = doc.reporte!;
    return [`- Período: ${r.periodo}`, `- Trabajadores: ${r.trabajadores}`, `- Días trabajados: ${r.dias}`, `- Accidentes: ${r.accidentes} (días perdidos: ${r.diasPerdidos})`].join("\n");
  }
  if (doc.tipo === "certificacion") {
    const d = await datosCertificacion(doc);
    const t = docCertificacion.totales(d);
    return [
      `- Cliente: ${d.cliente || "—"}`,
      `- Obra: ${d.direccion || "—"}`,
      `- Certificación ${d.tipo} (${d.alcance === "obra" ? "de obra" : "de trabajo adicional"}) del presupuesto ${d.presupuestoCodigo}`,
      `- Trabajos certificados: ${[...d.originales, ...d.adicionales.flatMap((a) => a.lineas)].map((l) => `${l.cantidad} · ${l.descripcion}`).join("; ") || "—"}`,
      `- Adicionales: ${d.adicionales.map((a) => a.codigo).join(", ") || "ninguno"}`,
      `- Total certificado: ${formatearMonto(t.total, d.moneda)} · Saldo por abonar: ${formatearMonto(t.pendiente, d.moneda)}`,
      ...d.pagos.map((p) => `- ${p.concepto}: ${p.estado} (${formatearMonto(p.importe, d.moneda)})`),
    ].join("\n");
  }
  if (doc.tipo === "control") {
    const d = await datosControl(doc);
    return [
      `- Cliente: ${d.cliente || "—"}`,
      `- Obra: ${d.direccion || "—"}`,
      `- Operarios: ${d.operadores.join(", ") || "—"}`,
      `- Registros: ${d.registros.length} (${rangoPisos(d.registros.map((r) => r.piso)) || "sin pisos"})`,
      ...d.balance.filas.map((f) => `- Ø ${f.diametroMm} mm: cotizadas ${f.cotizadas}, ejecutadas ${f.ejecutadas}, diferencia ${f.diferencia > 0 ? "+" : ""}${f.diferencia}`),
      `- Totales: cotizadas ${d.balance.totales.cotizadas}, ejecutadas ${d.balance.totales.ejecutadas}`,
      ...d.registros.filter((r) => r.observacion).map((r) => `- Observación piso ${r.piso}: ${r.observacion}`),
    ].join("\n");
  }
  const d = doc.tipo === "adicional" ? await datosAdicional(doc.adicionalId!) : await datosPresupuesto(doc.presupuestoId, doc.revisionId!);
  const [p] = await db.select({ pedido: presupuestos.pedido }).from(presupuestos).where(eq(presupuestos.id, doc.presupuestoId));
  const notas = (await db.select({ previas: visitas.notasPrevias, resultado: visitas.notasResultado }).from(visitas).where(eq(visitas.presupuestoId, doc.presupuestoId)))
    .flatMap((n) => [n.previas, n.resultado])
    .filter((x): x is string => !!x?.trim());
  return [
    `- Cliente: ${d.cliente || "—"}`,
    `- Obra: ${d.direccion || "—"}`,
    `- Ítems: ${d.items.map((i) => `${i.cantidad} ${UNIDADES[i.unidad]} · ${i.descripcion}`).join("; ") || "—"}`,
    `- Total neto: ${formatearMonto(d.totales.neto, d.moneda)}`,
    `- Validez de la oferta: ${d.validezDias} días · Anticipo: ${d.anticipoPct}%`,
    p?.pedido && `- Pedido del cliente: ${p.pedido}`,
    notas.length > 0 && `- Notas de la visita técnica: ${notas.join(" / ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Control de perforaciones (spec/06 §3.5) ───────────────────────────────────

async function datosControl(doc: Pick<typeof documentos.$inferSelect, "presupuestoId" | "nro" | "alcance" | "emitidoAt">): Promise<docControl.DatosControl> {
  const [p] = await db.select().from(presupuestos).where(eq(presupuestos.id, doc.presupuestoId));
  const [cli] = p.clienteId ? await db.select({ n: clientes.razonSocial }).from(clientes).where(eq(clientes.id, p.clienteId)) : [];
  const [obra] = p.obraId
    ? await db.select({ direccion: obras.direccion, director: directoresObra.nombre }).from(obras).leftJoin(directoresObra, eq(directoresObra.id, obras.directorId)).where(eq(obras.id, p.obraId))
    : [];
  return {
    codigo: `${codigo(p) ?? "Sin numerar"}-CP${doc.nro}`,
    fecha: doc.emitidoAt ?? new Date(),
    cliente: cli?.n ?? "",
    director: obra?.director ?? null,
    direccion: obra?.direccion ?? "",
    ...(await datosCampo(doc.presupuestoId, doc.alcance ?? null)),
  };
}

async function controlDe(documentoId: string) {
  const [doc] = await db.select().from(documentos).where(and(eq(documentos.id, documentoId), eq(documentos.tipo, "control")));
  if (!doc) throw new ErrorNegocio("El documento no existe.");
  return doc;
}

/** Controles del presupuesto (para listarlos en Campo). */
export async function listarControles(presupuestoId: string) {
  await accesoDocumento(presupuestoId, "leer", false);
  return db
    .select({ id: documentos.id, nro: documentos.nro, estado: documentos.estado, emitidoAt: documentos.emitidoAt, pdfEstado: documentos.pdfEstado, alcance: documentos.alcance })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.tipo, "control")))
    .orderBy(desc(documentos.nro));
}

/** Nuevo control -CPn en borrador (o el borrador que ya exista). */
export async function crearControl(presupuestoId: string) {
  const { usuario } = await accesoDocumento(presupuestoId, "escribir", false);
  const [p] = await db.select({ estado: presupuestos.estado }).from(presupuestos).where(eq(presupuestos.id, presupuestoId));
  if (!p || !["en_progreso", "pendiente_liquidacion", "terminado"].includes(p.estado)) throw new ErrorNegocio("El control se hace sobre un presupuesto en curso o terminado.");
  const [borrador] = await db
    .select({ id: documentos.id })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.tipo, "control"), eq(documentos.estado, "borrador")));
  if (borrador) return borrador.id;
  const [{ ultimo }] = await db
    .select({ ultimo: max(documentos.nro) })
    .from(documentos)
    .where(and(eq(documentos.presupuestoId, presupuestoId), eq(documentos.tipo, "control")));
  const nro = (ultimo ?? 0) + 1;
  const datos = await datosControl({ presupuestoId, nro, alcance: null, emitidoAt: null });
  const bloques = docControl.bloquesPorDefecto(datos);
  // El índice único (presupuesto, nro) frena un doble clic simultáneo.
  const [doc] = await db.insert(documentos).values({ tipo: "control", presupuestoId, nro, bloques }).returning();
  await db.insert(documentoVersiones).values({ documentoId: doc.id, nro: 1, bloques, origen: "sistema", userId: usuario.id });
  await auditar({ actorUserId: usuario.id, action: "documento.crear_control", entityType: "presupuesto", entityId: presupuestoId, entityLabel: datos.codigo });
  return doc.id;
}

export async function documentoControl(documentoId: string) {
  const doc = await controlDe(documentoId);
  await accesoDocumento(doc.presupuestoId, "leer", false);
  const datos = await datosControl(doc);
  return { doc, datos, editable: doc.estado === "borrador", defaults: docControl.bloquesPorDefecto(datos) };
}

/** Período de registros que abarca el control (sin fechas = todo lo ejecutado). */
export async function fijarAlcanceControl(documentoId: string, desde: string | null, hasta: string | null) {
  const doc = await controlDe(documentoId);
  const { usuario } = await accesoDocumento(doc.presupuestoId, "escribir", false);
  if (doc.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  if (desde && hasta && desde > hasta) throw new ErrorNegocio("La fecha desde no puede ser posterior a la fecha hasta.");
  const alcance = desde || hasta ? { desde, hasta } : null;
  await db.update(documentos).set({ alcance, updatedAt: new Date() }).where(eq(documentos.id, documentoId));
  await auditar({ actorUserId: usuario.id, action: "documento.alcance", entityType: "documento", entityId: documentoId, diff: { alcance } });
}

export async function emitirControl(documentoId: string) {
  const doc = await controlDe(documentoId);
  const { usuario } = await acceso(doc.presupuestoId, "documentos", "emitir");
  if (doc.estado !== "borrador") throw new ErrorNegocio("El documento ya fue emitido.");
  const fecha = new Date();
  const datos = { ...(await datosControl(doc)), fecha };
  if (datos.registros.length === 0) throw new ErrorNegocio("No hay registros de campo en el período elegido.");
  await emitirDocumento(doc, docControl.armar(datos, doc.bloques), fecha, usuario.id);
  await auditar({ actorUserId: usuario.id, action: "documento.emitir", entityType: "presupuesto", entityId: doc.presupuestoId, entityLabel: datos.codigo, diff: { documentoId, registros: datos.registros.length } });
  await notificarPresupuesto(doc.presupuestoId, usuario.id, { tipo: "documento_emitido", titulo: `Se emitió el control ${datos.codigo}`, link: `/presupuestos/${doc.presupuestoId}/controles/${documentoId}` });
  return datos.codigo;
}
