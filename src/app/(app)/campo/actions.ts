"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ESTADOS_REGISTRO } from "@/domain/balance";
import { confirmarFoto, editarRegistro, eliminarRegistro, prepararFoto, registrar, urlFoto, type DatosRegistro } from "@/services/campo";
import { ErrorNegocio } from "@/services/errores";
import { eliminarGasto, registrarGasto, type DatosGasto } from "@/services/gastos";

const numero = z.coerce.number().positive().nullable();
const datosSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  operarios: z.array(z.string().uuid()).min(1, "Elegí al menos un operario."),
  piso: z.string().trim().min(1, "Indicá el piso.").max(40),
  elemento: z.string().trim().min(1, "Indicá el elemento.").max(40),
  espesorCm: numero,
  diametroMm: numero,
  cantidad: z.coerce.number().int("La cantidad tiene que ser un entero.").min(1, "La cantidad tiene que ser mayor a 0."),
  itemId: z.string().uuid().nullable(),
  estado: z.enum(Object.keys(ESTADOS_REGISTRO) as [keyof typeof ESTADOS_REGISTRO]),
  observacion: z.string().max(500).nullable(),
}) satisfies z.ZodType<DatosRegistro>;

/** ErrorNegocio → { error } (rechazo definitivo); el resto se propaga (la cola reintenta). */
async function capturar<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

function datos(d: unknown) {
  const r = datosSchema.safeParse(d);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0]?.message ?? "Datos inválidos.");
  return r.data;
}

const refrescar = (presupuestoId: string) => {
  revalidatePath(`/campo/${presupuestoId}`);
  revalidatePath(`/presupuestos/${presupuestoId}`);
};

export async function accionRegistrar(presupuestoId: string, clientId: string, d: DatosRegistro) {
  return capturar(async () => {
    if (!z.string().uuid().safeParse(clientId).success) throw new ErrorNegocio("Identificador inválido.");
    const r = await registrar(presupuestoId, clientId, datos(d));
    refrescar(presupuestoId);
    return r;
  });
}

export async function accionPrepararFoto(registroId: string, f: { nombre: string; mime: string; bytes: number; tomadaAt: string }) {
  return capturar(() => prepararFoto(registroId, { nombre: f.nombre, mime: f.mime, bytes: f.bytes, tomadaAt: f.tomadaAt ? new Date(f.tomadaAt) : null }));
}

export async function accionConfirmarFoto(archivoId: string) {
  return capturar(async () => {
    await confirmarFoto(archivoId);
    return { ok: true as const };
  });
}

export async function accionEditarRegistro(presupuestoId: string, registroId: string, d: DatosRegistro) {
  return capturar(async () => {
    await editarRegistro(registroId, datos(d));
    refrescar(presupuestoId);
    return { ok: true as const };
  });
}

export async function accionEliminarRegistro(presupuestoId: string, registroId: string) {
  return capturar(async () => {
    await eliminarRegistro(registroId);
    refrescar(presupuestoId);
    return { ok: true as const };
  });
}

export async function accionUrlFoto(archivoId: string) {
  return capturar(async () => ({ url: await urlFoto(archivoId) }));
}

// ── Gastos (spec/08 §2) ───────────────────────────────────────────────────────

const gastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indicá la fecha."),
  presupuestoId: z.string().uuid().nullable(),
  categoriaId: z.string().uuid("Elegí una categoría."),
  descripcion: z.string().trim().min(1, "Describí el gasto.").max(300),
  importe: z.coerce.number().positive("El importe tiene que ser mayor a 0."),
  moneda: z.enum(["ARS", "USD"]),
  tipoCambio: z.coerce.number().positive().nullable(),
}) satisfies z.ZodType<DatosGasto>;

/** La usan el formulario del presupuesto, Finanzas (generales) y la cola offline de Campo. */
export async function accionRegistrarGasto(d: DatosGasto, clientId?: string): Promise<{ error?: string; ok?: string }> {
  const r = gastoSchema.safeParse(d);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const res = await capturar(() => registrarGasto(r.data, clientId));
  if (typeof res === "object" && "error" in res) return res;
  if (r.data.presupuestoId) revalidatePath(`/presupuestos/${r.data.presupuestoId}`);
  revalidatePath("/finanzas");
  return { ok: "Gasto registrado." };
}

export async function accionEliminarGasto(id: string, presupuestoId: string | null): Promise<{ error?: string; ok?: string }> {
  const res = await capturar(() => eliminarGasto(id));
  if (typeof res === "object" && res && "error" in res) return res;
  if (presupuestoId) revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/finanzas");
  return { ok: "Gasto eliminado." };
}
