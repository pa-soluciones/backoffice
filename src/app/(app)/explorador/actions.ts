"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buscar } from "@/services/busqueda";
import {
  actualizarCliente,
  archivarCliente,
  crearCliente,
  eliminarCliente,
  sugerirClientes,
} from "@/services/clientes";
import { actualizarDirector, crearDirector, eliminarDirector } from "@/services/directores";
import { ErrorNegocio } from "@/services/errores";
import { actualizarObra, crearObra, eliminarObra } from "@/services/obras";

export type Estado = { error?: string } | undefined;

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((s) => s || null);
const emailOpcional = opcional.pipe(z.email("Email inválido.").nullable());
const primerError = (r: z.ZodSafeParseError<unknown>) => r.error.issues[0]?.message ?? "Datos inválidos.";

/** Ejecuta, traduce errores de negocio y redirige al terminar. */
async function guardar(fn: () => Promise<string>, rutasAInvalidar: string[]): Promise<Estado> {
  let destino: string;
  try {
    destino = await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
  for (const r of rutasAInvalidar) revalidatePath(r);
  redirect(destino);
}

// ── Clientes ──────────────────────────────────────────────────────────────────

const clienteSchema = z.object({
  razonSocial: z.string().trim().min(2, "Ingresá la razón social."),
  cuit: opcional,
  telefono: opcional,
  email: emailOpcional,
  notas: opcional,
});

export async function accionGuardarCliente(_: Estado, fd: FormData): Promise<Estado> {
  const r = clienteSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const id = String(fd.get("id") ?? "");
  return guardar(async () => {
    if (id) {
      await actualizarCliente(id, r.data);
      return `/explorador/${id}`;
    }
    return `/explorador/${await crearCliente(r.data)}`;
  }, ["/explorador"]);
}

export async function accionSugerirClientes(texto: string, excepto?: string) {
  return sugerirClientes(texto, excepto);
}

export async function accionArchivarCliente(id: string, archivado: boolean): Promise<Estado> {
  await archivarCliente(id, archivado);
  revalidatePath("/explorador");
  redirect(archivado ? "/explorador" : `/explorador/${id}`);
}

export async function accionEliminarCliente(id: string): Promise<Estado> {
  return guardar(async () => {
    await eliminarCliente(id);
    return "/explorador";
  }, ["/explorador"]);
}

// ── Obras ─────────────────────────────────────────────────────────────────────

const obraSchema = z.object({
  nombre: opcional,
  direccion: z.string().trim().min(3, "Ingresá la dirección de la obra."),
  localidad: opcional,
  provincia: opcional,
  directorId: opcional.transform((v) => (v === "__nuevo__" ? null : v)).pipe(z.uuid().nullable()),
  nuevoDirector: opcional,
  hysNombre: opcional,
  notas: opcional,
});

export async function accionGuardarObra(_: Estado, fd: FormData): Promise<Estado> {
  const r = obraSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const clienteId = String(fd.get("clienteId"));
  const id = String(fd.get("id") ?? "");
  return guardar(async () => {
    if (id) await actualizarObra(id, r.data);
    const obraId = id || (await crearObra(clienteId, r.data));
    return `/explorador/${clienteId}/${obraId}`;
  }, ["/explorador", `/explorador/${clienteId}`]);
}

export async function accionEliminarObra(clienteId: string, id: string): Promise<Estado> {
  return guardar(async () => {
    await eliminarObra(id);
    return `/explorador/${clienteId}`;
  }, [`/explorador/${clienteId}`]);
}

// ── Directores ────────────────────────────────────────────────────────────────

const directorSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá nombre y apellido."),
  telefono: opcional,
  email: emailOpcional,
  empresa: opcional,
  notas: opcional,
});

export async function accionGuardarDirector(_: Estado, fd: FormData): Promise<Estado> {
  const r = directorSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const id = String(fd.get("id") ?? "");
  return guardar(async () => {
    if (id) {
      await actualizarDirector(id, r.data);
      return `/directores/${id}`;
    }
    return `/directores/${await crearDirector(r.data)}`;
  }, ["/directores"]);
}

export async function accionEliminarDirector(id: string): Promise<Estado> {
  return guardar(async () => {
    await eliminarDirector(id);
    return "/directores";
  }, ["/directores"]);
}

// ── Buscador ──────────────────────────────────────────────────────────────────

export async function accionBuscar(texto: string) {
  return buscar(texto);
}
