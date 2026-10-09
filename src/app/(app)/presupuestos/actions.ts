"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ELEMENTOS, TIPOS_SERVICIO, UNIDADES } from "@/domain/items";
import { ESTADOS, type Estado } from "@/domain/workflow";
import {
  cambiarEstadoAdicional,
  crearAdicional,
  emitirAdicional,
  guardarCondicionesAdicional,
  guardarItemsAdicional,
} from "@/services/adicionales";
import { ESTADOS_ADICIONAL, type EstadoAdicional } from "@/domain/adicionales";
import { agendarVisita, resolverVisita } from "@/services/agenda";
import { confirmarAnexo, eliminarAnexo, prepararAnexo, urlAnexo } from "@/services/anexos";
import { eliminarCobro, registrarCobro } from "@/services/cobros";
import { MEDIOS } from "@/domain/cobros";
import { crearControl, descargar, emitirControl, fijarAlcanceControl, guardarBloques, restaurarVersion } from "@/services/documentos";
import { proponerBloque } from "@/services/ia";
import type { AccionIA } from "@/domain/ia";
import { ErrorNegocio } from "@/services/errores";
import {
  actualizarProspecto,
  cambiarEstado,
  crearPresupuesto,
  eliminarPresupuesto,
  emitirRevision,
  guardarComerciales,
  guardarItems,
  nuevaRevision,
  reabrir,
} from "@/services/presupuestos";

export type Estado_ = { error?: string; ok?: string } | undefined;

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((s) => s || null);
const numeroOpcional = opcional.transform((v) => (v == null ? null : Number(v.replace(",", "."))));
const primerError = (r: z.ZodSafeParseError<unknown>) => r.error.issues[0]?.message ?? "Datos inválidos.";

async function ejecutar(fn: () => Promise<string | void>, revalidar: string[]): Promise<Estado_> {
  let destino: string | void;
  try {
    destino = await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
  for (const r of revalidar) revalidatePath(r);
  if (destino) redirect(destino);
  return { ok: "Guardado." };
}

// ── Prospecto ─────────────────────────────────────────────────────────────────

const prospectoSchema = z.object({
  clienteId: opcional.pipe(z.uuid().nullable()),
  obraId: opcional.pipe(z.uuid().nullable()),
  contactoNombre: opcional,
  contactoTelefono: opcional,
  contactoEmail: opcional.pipe(z.email("Email inválido.").nullable()),
  origen: opcional,
  pedido: opcional,
  requiereVisita: z.literal("on").optional().transform(Boolean),
});

export async function accionGuardarProspecto(_: Estado_, fd: FormData): Promise<Estado_> {
  const r = prospectoSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const datos = { ...r.data, asignados: fd.getAll("asignados").map(String) };
  const id = String(fd.get("id") ?? "");
  return ejecutar(async () => {
    if (id) {
      await actualizarProspecto(id, datos);
      return `/presupuestos/${id}`;
    }
    return `/presupuestos/${await crearPresupuesto(datos)}`;
  }, ["/presupuestos", "/explorador"]);
}

// ── Ítems y condiciones ───────────────────────────────────────────────────────

const numero = (msg: string) => z.coerce.number({ error: msg }).finite();
const itemSchema = z.object({
  tipoServicio: z.enum(Object.keys(TIPOS_SERVICIO) as [keyof typeof TIPOS_SERVICIO]),
  elemento: z.enum(ELEMENTOS).nullable(),
  diametroMm: numero("Ø inválido").positive().nullable(),
  espesorCm: numero("Espesor inválido").positive().nullable(),
  unidad: z.enum(Object.keys(UNIDADES) as [keyof typeof UNIDADES]),
  cantidad: numero("Cantidad inválida").positive("La cantidad tiene que ser mayor a 0."),
  precioUnitario: numero("Precio inválido").min(0, "El precio no puede ser negativo."),
  descripcion: z.string().nullable(),
});

export async function accionGuardarItems(id: string, json: string): Promise<Estado_> {
  const r = z.array(itemSchema).max(200).safeParse(JSON.parse(json));
  if (!r.success) return { error: primerError(r) };
  return ejecutar(() => guardarItems(id, r.data), [`/presupuestos/${id}`, "/presupuestos"]);
}

const comercialesSchema = z
  .object({
    moneda: z.enum(["ARS", "USD"]),
    tipoCambioRef: numeroOpcional.pipe(z.number().positive("Tipo de cambio inválido.").nullable()),
    incluyeIva: z.literal("on").optional().transform(Boolean),
    ivaPct: z.coerce.number().min(0).max(100),
    validezDias: z.coerce.number().int().min(1, "La validez tiene que ser de al menos 1 día."),
    formaContratacion: z.string().trim().min(1),
    baseAjuste: z.string().trim().min(1),
    anticipoPct: z.coerce.number().min(0).max(100, "El anticipo no puede superar el 100%."),
    bonifTipo: z.enum(["", "pct", "monto"]),
    bonifValor: numeroOpcional.pipe(z.number().positive("La bonificación tiene que ser mayor a 0.").nullable()),
  })
  .refine((d) => !d.bonifTipo || d.bonifValor, "Indicá el valor de la bonificación.")
  .refine((d) => d.bonifTipo !== "pct" || (d.bonifValor ?? 0) < 100, "La bonificación tiene que ser menor al 100%.");

export async function accionGuardarComerciales(_: Estado_, fd: FormData): Promise<Estado_> {
  const r = comercialesSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const { bonifTipo, bonifValor, ...resto } = r.data;
  const id = String(fd.get("id"));
  return ejecutar(
    () => guardarComerciales(id, { ...resto, bonificacion: bonifTipo && bonifValor ? { tipo: bonifTipo, valor: bonifValor } : null }),
    [`/presupuestos/${id}`, "/presupuestos"],
  );
}

// ── Revisiones, estado y eliminación ──────────────────────────────────────────

export async function accionEmitir(id: string): Promise<Estado_> {
  let cod = "";
  const r = await ejecutar(async () => {
    cod = await emitirRevision(id);
  }, [`/presupuestos/${id}`, "/presupuestos"]);
  return r?.error ? r : { ok: `Emitido ${cod}.` };
}

export async function accionNuevaRevision(id: string): Promise<Estado_> {
  return ejecutar(() => nuevaRevision(id), [`/presupuestos/${id}`]);
}

export async function accionCambiarEstado(id: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const hasta = String(fd.get("hasta")) as Estado;
  if (!(hasta in ESTADOS)) return { error: "Estado inválido." };
  const motivo = String(fd.get("motivo") ?? "").trim() || null;
  const fechaConfirmacion = String(fd.get("fechaConfirmacion") ?? "") || null;
  return ejecutar(() => cambiarEstado(id, hasta, { motivo, fechaConfirmacion }), [`/presupuestos/${id}`, "/presupuestos"]);
}

export async function accionReabrir(id: string, _: Estado_, fd: FormData): Promise<Estado_> {
  return ejecutar(() => reabrir(id, String(fd.get("motivo") ?? "")), [`/presupuestos/${id}`, "/presupuestos"]);
}

export async function accionEliminar(id: string): Promise<Estado_> {
  return ejecutar(async () => {
    await eliminarPresupuesto(id);
    return "/presupuestos";
  }, ["/presupuestos"]);
}

// ── Visitas ───────────────────────────────────────────────────────────────────

const visitaSchema = z.object({
  inicio: opcional,
  duracionMin: z.coerce.number().int().min(15).max(24 * 60),
  direccion: opcional,
  contactoSitio: opcional,
  notasPrevias: opcional,
});

export async function accionAgendarVisita(presupuestoId: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const r = visitaSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  // datetime-local viene sin zona: es hora de Argentina (UTC-3, sin horario de verano).
  const inicio = r.data.inicio ? new Date(`${r.data.inicio}:00-03:00`) : null;
  return ejecutar(
    () => agendarVisita(presupuestoId, { ...r.data, inicio, responsables: fd.getAll("responsables").map(String) }).then(() => undefined),
    [`/presupuestos/${presupuestoId}`, "/agenda"],
  );
}

export async function accionResolverVisita(presupuestoId: string, visitaId: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const estado = String(fd.get("estado")) as "realizada" | "omitida" | "cancelada";
  if (!["realizada", "omitida", "cancelada"].includes(estado)) return { error: "Estado inválido." };
  return ejecutar(() => resolverVisita(visitaId, estado, String(fd.get("notas") ?? "").trim() || null), [`/presupuestos/${presupuestoId}`, "/agenda"]);
}

// ── Documento ─────────────────────────────────────────────────────────────────

export async function accionGuardarBloques(
  documentoId: string,
  ruta: string,
  json: string,
  origen: "usuario" | "ia" = "usuario",
): Promise<Estado_ & { version?: number }> {
  const r = z.record(z.string(), z.string().max(10_000)).safeParse(JSON.parse(json));
  if (!r.success) return { error: "Datos inválidos." };
  try {
    const version = await guardarBloques(documentoId, r.data, origen === "ia" ? "ia" : "usuario");
    revalidatePath(ruta);
    return { ok: "Guardado.", version };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

export async function accionRestaurarVersion(documentoId: string, ruta: string, nro: number): Promise<Estado_ & { bloques?: Record<string, string> }> {
  try {
    const bloques = await restaurarVersion(documentoId, nro);
    revalidatePath(ruta);
    return { ok: `Versión ${nro} restaurada.`, bloques };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

export async function accionUrlDescarga(documentoId: string, formato: "docx" | "pdf"): Promise<{ url?: string; error?: string }> {
  try {
    return { url: await descargar(documentoId, formato) };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

// ── IA ────────────────────────────────────────────────────────────────────────

export async function accionProponerIA(
  documentoId: string,
  bloqueId: string,
  accion: AccionIA,
  instruccion: string | null,
  textoActual: string,
): Promise<{ texto?: string; advertencias?: string[]; error?: string }> {
  try {
    return await proponerBloque(documentoId, bloqueId, accion, instruccion, textoActual);
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

// ── Adicionales ───────────────────────────────────────────────────────────────

export async function accionCrearAdicional(presupuestoId: string): Promise<Estado_> {
  return ejecutar(async () => `/presupuestos/${presupuestoId}/adicionales/${await crearAdicional(presupuestoId)}`, [`/presupuestos/${presupuestoId}`]);
}

const rutaAdicional = (presupuestoId: string, id: string) => `/presupuestos/${presupuestoId}/adicionales/${id}`;

export async function accionGuardarItemsAdicional(presupuestoId: string, id: string, json: string): Promise<Estado_> {
  const r = z.array(itemSchema).max(200).safeParse(JSON.parse(json));
  if (!r.success) return { error: primerError(r) };
  return ejecutar(() => guardarItemsAdicional(id, r.data), [rutaAdicional(presupuestoId, id), `/presupuestos/${presupuestoId}`]);
}

export async function accionCondicionesAdicional(presupuestoId: string, id: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const r = z
    .object({
      validezDias: z.coerce.number().int().min(1, "La validez tiene que ser de al menos 1 día."),
      anticipoPct: z.coerce.number().min(0).max(100),
      mantieneBonificacion: z.literal("on").optional().transform(Boolean),
    })
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  return ejecutar(() => guardarCondicionesAdicional(id, r.data), [rutaAdicional(presupuestoId, id)]);
}

export async function accionEmitirAdicional(presupuestoId: string, id: string): Promise<Estado_> {
  let cod = "";
  const r = await ejecutar(async () => {
    cod = await emitirAdicional(id);
  }, [rutaAdicional(presupuestoId, id), `/presupuestos/${presupuestoId}`]);
  return r?.error ? r : { ok: `Emitido ${cod}.` };
}

export async function accionEstadoAdicional(presupuestoId: string, id: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const hasta = String(fd.get("hasta")) as EstadoAdicional;
  if (!(hasta in ESTADOS_ADICIONAL)) return { error: "Estado inválido." };
  return ejecutar(
    () => cambiarEstadoAdicional(id, hasta, String(fd.get("motivo") ?? "").trim() || null),
    [rutaAdicional(presupuestoId, id), `/presupuestos/${presupuestoId}`],
  );
}

// ── Anexos ────────────────────────────────────────────────────────────────────

async function capturar<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

export async function accionPrepararAnexo(presupuestoId: string, d: { nombre: string; mime: string; bytes: number; categoria: string; descripcion: string | null }) {
  return capturar(() => prepararAnexo(presupuestoId, d));
}

export async function accionConfirmarAnexo(presupuestoId: string, archivoId: string): Promise<Estado_> {
  return ejecutar(() => confirmarAnexo(archivoId), [`/presupuestos/${presupuestoId}`]);
}

export async function accionUrlAnexo(archivoId: string) {
  return capturar(async () => ({ url: await urlAnexo(archivoId) }));
}

export async function accionEliminarAnexo(presupuestoId: string, archivoId: string): Promise<Estado_> {
  return ejecutar(() => eliminarAnexo(archivoId), [`/presupuestos/${presupuestoId}`]);
}

// ── Control de perforaciones ──────────────────────────────────────────────────

const rutaControl = (presupuestoId: string, id: string) => `/presupuestos/${presupuestoId}/controles/${id}`;

export async function accionCrearControl(presupuestoId: string): Promise<Estado_> {
  return ejecutar(async () => rutaControl(presupuestoId, await crearControl(presupuestoId)), [`/presupuestos/${presupuestoId}/campo`]);
}

export async function accionAlcanceControl(presupuestoId: string, id: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const fecha = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(fd.get(k))) ? String(fd.get(k)) : null);
  return ejecutar(() => fijarAlcanceControl(id, fecha("desde"), fecha("hasta")), [rutaControl(presupuestoId, id)]);
}

export async function accionEmitirControl(presupuestoId: string, id: string): Promise<Estado_> {
  let cod = "";
  const r = await ejecutar(async () => {
    cod = await emitirControl(id);
  }, [rutaControl(presupuestoId, id), `/presupuestos/${presupuestoId}/campo`]);
  return r?.error ? r : { ok: `Emitido ${cod}.` };
}

// ── Cobros ────────────────────────────────────────────────────────────────────

const cobroSchema = z.object({
  cobroEsperadoId: z.string().uuid().nullable(),
  descripcionOtro: z.string().max(200).nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indicá la fecha."),
  importe: z.coerce.number().positive("El importe tiene que ser mayor a 0."),
  monedaRecibida: z.enum(["ARS", "USD"]),
  tipoCambio: z.coerce.number().positive().nullable(),
  medio: z.enum(Object.keys(MEDIOS) as [keyof typeof MEDIOS]),
  referencia: z.string().max(200).nullable(),
});

export async function accionRegistrarCobro(presupuestoId: string, _: Estado_, fd: FormData): Promise<Estado_> {
  const v = (k: string) => (String(fd.get(k) ?? "").trim() ? String(fd.get(k)).trim() : null);
  const concepto = v("concepto");
  const r = cobroSchema.safeParse({
    cobroEsperadoId: concepto === "otro" ? null : concepto,
    descripcionOtro: v("descripcionOtro"),
    fecha: v("fecha"),
    importe: v("importe"),
    monedaRecibida: v("monedaRecibida"),
    tipoCambio: v("tipoCambio"),
    medio: v("medio"),
    referencia: v("referencia"),
  });
  if (!r.success) return { error: primerError(r) };
  let terminado = false;
  const res = await ejecutar(async () => {
    terminado = (await registrarCobro(presupuestoId, r.data)).terminado;
  }, [`/presupuestos/${presupuestoId}`]);
  return res?.error ? res : { ok: terminado ? "Cobro registrado. Saldo cancelado: el presupuesto pasó a Terminado." : "Cobro registrado." };
}

export async function accionEliminarCobro(presupuestoId: string, cobroId: string): Promise<Estado_> {
  return ejecutar(() => eliminarCobro(presupuestoId, cobroId), [`/presupuestos/${presupuestoId}`]);
}
