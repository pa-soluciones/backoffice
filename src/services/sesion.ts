import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { rolePermissions, roles, userPermissions, userRoles } from "@/db/schema";
import {
  alcanceDe,
  permisosEfectivos,
  todosLosPermisos,
  type Accion,
  type Modulo,
  type Permiso,
} from "@/domain/permisos";
import { auth } from "@/lib/auth";

// Capa de acceso a sesión y permisos (Data Access Layer). Toda verificación pasa por acá.

export const getSesion = cache(async () => auth.api.getSession({ headers: await headers() }));

export type Usuario = NonNullable<Awaited<ReturnType<typeof getSesion>>>["user"];

/** Usuario logueado o redirect a /login. No exige el asistente completo. */
export async function requireSesion(): Promise<Usuario> {
  const s = await getSesion();
  if (!s) redirect("/login");
  return s.user;
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
  if (!alcance) redirect("/sin-permiso");
  return { usuario, alcance };
}
