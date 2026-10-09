"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODULOS, type Permiso } from "@/domain/permisos";
import { FREE_TIER } from "@/domain/cuota-r2";
import { fijarProximoNumero, guardarDefaults } from "@/services/configuracion";
import { aprobarExcedente } from "@/services/cuota-r2";
import { actualizarRol, crearRol, eliminarRol } from "@/services/roles";
import {
  actualizarUsuario,
  cambiarActivo,
  crearUsuario,
  resetear2fa,
  resetearPassword,
} from "@/services/usuarios";
import { ErrorNegocio } from "@/services/errores";

export type Estado = { error?: string; ok?: boolean; temporal?: string; id?: string } | undefined;

const permisosSchema = z
  .string()
  .transform((s) => JSON.parse(s) as unknown)
  .pipe(
    z.array(
      z.object({
        modulo: z.string(),
        accion: z.string(),
        alcance: z.enum(["todos", "asignados"]),
      }),
    ),
  )
  .transform((ps) =>
    ps.filter((p) => (MODULOS[p.modulo as keyof typeof MODULOS]?.acciones as readonly string[] | undefined)?.includes(p.accion)),
  ) as z.ZodType<Permiso[]>;

const opcional = z
  .string()
  .trim()
  .transform((s) => s || null);

async function ejecutar(fn: () => Promise<Estado>): Promise<Estado> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e; // redirects de permisos y errores reales
  }
}

const primerError = (r: z.ZodSafeParseError<unknown>) => r.error.issues[0]?.message ?? "Datos inválidos.";

// ── Usuarios ──────────────────────────────────────────────────────────────────

const usuarioSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre."),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,30}$/, "El usuario: 3 a 30 letras, números, punto, guion o guion bajo."),
  email: opcional.pipe(z.email("Email inválido.").nullable()),
  telefono: opcional,
  permisos: permisosSchema,
});

export async function accionGuardarUsuario(_: Estado, fd: FormData): Promise<Estado> {
  const r = usuarioSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const datos = { ...r.data, roleIds: fd.getAll("roleIds").map(String) };
  const id = String(fd.get("id") ?? "");
  return ejecutar(async () => {
    if (!id) {
      const creado = await crearUsuario(datos);
      revalidatePath("/ajustes/usuarios");
      return { ok: true, ...creado };
    }
    await actualizarUsuario(id, datos);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  });
}

export async function accionCambiarActivo(id: string, activo: boolean): Promise<Estado> {
  return ejecutar(async () => {
    await cambiarActivo(id, activo);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  });
}

export async function accionResetPassword(id: string): Promise<Estado> {
  return ejecutar(async () => ({ ok: true, temporal: await resetearPassword(id) }));
}

export async function accionReset2fa(id: string): Promise<Estado> {
  return ejecutar(async () => {
    await resetear2fa(id);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  });
}

// ── Roles ─────────────────────────────────────────────────────────────────────

const rolSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre del rol."),
  descripcion: opcional,
  requiere2fa: z.literal("on").optional().transform(Boolean),
  permisos: permisosSchema,
});

export async function accionGuardarRol(_: Estado, fd: FormData): Promise<Estado> {
  const r = rolSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const id = String(fd.get("id") ?? "");
  const res = await ejecutar(async () => {
    if (id) await actualizarRol(id, r.data);
    else await crearRol(r.data);
    return { ok: true };
  });
  if (res?.error) return res;
  revalidatePath("/ajustes/roles");
  redirect("/ajustes/roles");
}

export async function accionEliminarRol(id: string): Promise<Estado> {
  const res = await ejecutar(async () => {
    await eliminarRol(id);
    return { ok: true };
  });
  if (res?.error) return res;
  revalidatePath("/ajustes/roles");
  redirect("/ajustes/roles");
}

// ── Presupuestos: defaults y numeración ───────────────────────────────────────

const defaultsSchema = z.object({
  validezDias: z.coerce.number().int().min(1, "La validez tiene que ser de al menos 1 día."),
  anticipoPct: z.coerce.number().min(0).max(100),
  ivaPct: z.coerce.number().min(0).max(100),
  formaContratacion: z.string().trim().min(1),
  baseAjuste: z.string().trim().min(1),
});

export async function accionGuardarDefaults(_: Estado, fd: FormData): Promise<Estado> {
  const r = defaultsSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  return ejecutar(async () => {
    await guardarDefaults(r.data);
    revalidatePath("/ajustes/presupuestos");
    return { ok: true };
  });
}

export async function accionFijarNumero(anio: number, _: Estado, fd: FormData): Promise<Estado> {
  const proximo = Number(fd.get("proximo"));
  return ejecutar(async () => {
    await fijarProximoNumero(anio, proximo);
    revalidatePath("/ajustes/presupuestos");
    return { ok: true };
  });
}

// ── Almacenamiento (cuota de R2) ──────────────────────────────────────────────

export async function accionAprobarExcedente(_: Estado, fd: FormData): Promise<Estado> {
  const factor = Number(fd.get("factor"));
  if (![1, 1.5, 2].includes(factor)) return { error: "Elegí una opción." };
  if (fd.get("acepto") !== "on") return { error: "Tenés que confirmar que entendés que puede generar cargos." };
  return ejecutar(async () => {
    await aprobarExcedente({
      almacenamiento: Math.floor(FREE_TIER.almacenamiento * factor),
      opsA: Math.floor(FREE_TIER.opsA * factor),
      opsB: Math.floor(FREE_TIER.opsB * factor),
    });
    revalidatePath("/ajustes/almacenamiento");
    return { ok: true };
  });
}
