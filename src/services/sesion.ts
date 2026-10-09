import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { rolePermissions, roles, userPermissions, userRoles } from "@/db/schema";
import {
  alcanceDe,
  MODULOS,
  permisosEfectivos,
  todosLosPermisos,
  type Accion,
  type Modulo,
  type Permiso,
} from "@/domain/permisos";
import { auth } from "@/lib/auth";
import { contextoMcp } from "./contexto";
import { ErrorNegocio } from "./errores";

// Capa de acceso a sesión y permisos (Data Access Layer). Toda verificación pasa por acá.

const sesionBetterAuth = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Sesión del navegador o, en una llamada MCP, el usuario dueño del token. */
export const getSesion = async () => {
  const mcp = contextoMcp();
  return mcp ? { user: mcp.usuario } : sesionBetterAuth();
};

export type Usuario = NonNullable<Awaited<ReturnType<typeof sesionBetterAuth>>>["user"];

/** Usuario logueado o redirect a /login. No exige el asistente completo. */
export async function requireSesion(): Promise<Usuario> {
  const s = await getSesion();
  if (!s) redirect("/login");
  return s.user as Usuario;
}

/** Roles del usuario con sus flags (para saber si es admin o si le exigen 2FA). */
export const getRoles = cache(async (userId: string) =>
  db
    .select({ id: roles.id, nombre: roles.nombre, esSistema: roles.esSistema, requiere2fa: roles.requiere2fa })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId)),
);

/** El usuario tiene pasos obligatorios pendientes (contraseña, recuperación, 2FA). */
export async function tienePendientes(u: Usuario) {
  if (u.mustChangePassword || u.mustCompleteSetup) return true;
  const rs = await getRoles(u.id);
  return !u.twoFactorEnabled && rs.some((r) => r.requiere2fa);
}

/** Usuario logueado y con el asistente/2FA obligatorios completos. */
export async function requireUsuario(): Promise<Usuario> {
  const u = await requireSesion();
  if (contextoMcp()) return u; // el token ya exige un usuario activo
  if (await tienePendientes(u)) redirect("/configuracion-inicial");
  return u;
}

export const getPermisos = cache(async (userId: string) => {
  const rs = await getRoles(userId);
  if (rs.some((r) => r.esSistema)) return permisosEfectivos(todosLosPermisos());

  const [deRoles, directos] = await Promise.all([
    db
      .select({ modulo: rolePermissions.modulo, accion: rolePermissions.accion, alcance: rolePermissions.alcance })
      .from(rolePermissions)
      .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
      .where(eq(userRoles.userId, userId)),
    db
      .select({ modulo: userPermissions.modulo, accion: userPermissions.accion, alcance: userPermissions.alcance })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId)),
  ]);
  return permisosEfectivos([...deRoles, ...directos] as Permiso[]);
});

export async function esAdmin(userId: string) {
  return (await getRoles(userId)).some((r) => r.esSistema);
}

/** Exige permiso; devuelve usuario y alcance. Sin permiso → /sin-permiso. */
export async function requirePermiso(modulo: Modulo, accion: Accion) {
  const usuario = await requireUsuario();
  const alcance = alcanceDe(await getPermisos(usuario.id), modulo, accion);
  if (contextoMcp()) {
    // RF-MCP-03/07: por MCP nunca se elimina; sin permiso, error legible (no redirect).
    if (accion === "eliminar") throw new ErrorNegocio("Por MCP no se puede eliminar nada. Hacelo desde la app.");
    if (!alcance) throw new ErrorNegocio(`No tenés permiso para ${accion.replace("_", " ")} en ${MODULOS[modulo].label}.`);
  }
  if (!alcance) redirect("/sin-permiso");
  return { usuario, alcance };
}
