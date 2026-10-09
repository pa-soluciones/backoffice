"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATEGORIAS_ARTICULO, UNIDADES_ARTICULO } from "@/domain/stock";
import { ErrorNegocio } from "@/services/errores";
import {
  actualizarArticulo,
  ajustarStock,
  asignarMateriales,
  cerrarMateriales,
  crearArticulo,
  devolverMateriales,
  registrarCompra,
  registrarConsumo,
  type DatosArticulo,
} from "@/services/stock";

export type Estado = { error?: string; ok?: string } | undefined;

async function ejecutar(fn: () => Promise<unknown>, revalidar: string[], ok = "Guardado."): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
  for (const r of revalidar) revalidatePath(r);
  return { ok };
}

const texto = (fd: FormData, k: string) => (String(fd.get(k) ?? "").trim() ? String(fd.get(k)).trim() : null);
const numero = (fd: FormData, k: string) => (texto(fd, k) == null ? null : Number(texto(fd, k)));

const articuloSchema = z.object({
  nombre: z.string().trim().min(1, "Indicá el nombre.").max(120),
  categoria: z.enum(CATEGORIAS_ARTICULO, { message: "Elegí una categoría." }),
  unidad: z.enum(Object.keys(UNIDADES_ARTICULO) as [keyof typeof UNIDADES_ARTICULO]),
  atributos: z.record(z.string(), z.string()),
  stockMinimo: z.number().min(0).nullable(),
  notas: z.string().max(500).nullable(),
}) satisfies z.ZodType<DatosArticulo>;

function datosArticulo(fd: FormData) {
  const atributos = Object.fromEntries((["diametro", "marca", "modelo"] as const).map((k) => [k, texto(fd, k) ?? ""]).filter(([, v]) => v));
  return articuloSchema.safeParse({ nombre: texto(fd, "nombre") ?? "", categoria: texto(fd, "categoria"), unidad: texto(fd, "unidad") ?? "u", atributos, stockMinimo: numero(fd, "stockMinimo"), notas: texto(fd, "notas") });
}

export async function accionCrearArticulo(_: Estado, fd: FormData): Promise<Estado> {
  const r = datosArticulo(fd);
  if (!r.success) return { error: r.error.issues[0]?.message };
  let id = "";
  const res = await ejecutar(async () => (id = await crearArticulo(r.data)), ["/stock"]);
  if (res?.error) return res;
  redirect(`/stock/${id}`);
}

export async function accionActualizarArticulo(id: string, _: Estado, fd: FormData): Promise<Estado> {
  const r = datosArticulo(fd);
  if (!r.success) return { error: r.error.issues[0]?.message };
  return ejecutar(() => actualizarArticulo(id, r.data), ["/stock", `/stock/${id}`]);
}

export async function accionAjuste(id: string, _: Estado, fd: FormData): Promise<Estado> {
  const tipo = fd.get("tipo") === "baja" ? "baja" : "ajuste";
  const cantidad = numero(fd, "cantidad");
  if (cantidad == null || cantidad === 0) return { error: "Indicá la cantidad." };
  return ejecutar(() => ajustarStock(id, tipo, cantidad, texto(fd, "motivo") ?? ""), ["/stock", `/stock/${id}`], tipo === "baja" ? "Baja registrada." : "Ajuste registrado.");
}

const compraSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indicá la fecha."),
  proveedorId: z.string().uuid().nullable(),
  proveedorNuevo: z.string().max(120).nullable(),
  destinoPresupuestoId: z.string().uuid().nullable(),
  moneda: z.enum(["ARS", "USD"]),
  tipoCambio: z.number().positive().nullable(),
  lineas: z
    .array(
      z.object({
        articuloId: z.string().uuid().nullable(),
        nuevo: z.object({ nombre: z.string().trim().min(1, "Indicá el nombre del artículo nuevo."), categoria: z.enum(CATEGORIAS_ARTICULO), unidad: z.string() }).nullable(),
        cantidad: z.number().positive("Las cantidades tienen que ser mayores a 0."),
        precioUnitario: z.number().min(0),
      }),
    )
    .min(1, "Agregá al menos un artículo."),
});

export async function accionRegistrarCompra(json: string): Promise<Estado> {
  const r = compraSchema.safeParse(JSON.parse(json));
  if (!r.success) return { error: r.error.issues[0]?.message };
  return ejecutar(() => registrarCompra(r.data), ["/stock", ...(r.data.destinoPresupuestoId ? [`/presupuestos/${r.data.destinoPresupuestoId}`] : [])], "Compra registrada.");
}

const lineas = z.array(z.object({ articuloId: z.string().uuid(), cantidad: z.number().positive("Las cantidades tienen que ser mayores a 0.") })).min(1, "Elegí al menos un artículo.");

export async function accionAsignar(presupuestoId: string, json: string): Promise<Estado> {
  const r = lineas.safeParse(JSON.parse(json));
  if (!r.success) return { error: r.error.issues[0]?.message };
  return ejecutar(() => asignarMateriales(presupuestoId, r.data), [`/presupuestos/${presupuestoId}`, "/stock"], "Materiales asignados.");
}

export async function accionDevolver(presupuestoId: string, json: string): Promise<Estado> {
  const r = lineas.safeParse(JSON.parse(json));
  if (!r.success) return { error: r.error.issues[0]?.message };
  return ejecutar(() => devolverMateriales(presupuestoId, r.data, null), [`/presupuestos/${presupuestoId}`, "/stock"], "Devuelto al depósito.");
}

/** También la usa la cola offline de Campo. */
export async function accionConsumo(presupuestoId: string, articuloId: string, cantidad: number, clientId?: string): Promise<Estado> {
  return ejecutar(() => registrarConsumo(presupuestoId, { articuloId, cantidad }, clientId), [`/presupuestos/${presupuestoId}`], "Consumo registrado.");
}

const cierre = z.array(z.object({ articuloId: z.string().uuid(), consumido: z.number().min(0), devuelto: z.number().min(0), nota: z.string().max(200).nullable() }));

export async function accionCierreMateriales(presupuestoId: string, json: string): Promise<Estado> {
  const r = cierre.safeParse(JSON.parse(json));
  if (!r.success) return { error: "Datos inválidos." };
  return ejecutar(() => cerrarMateriales(presupuestoId, r.data), [`/presupuestos/${presupuestoId}`, "/stock"], "Cierre de materiales completo.");
}
