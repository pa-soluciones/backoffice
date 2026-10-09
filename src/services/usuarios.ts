import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { account, roles, session, twoFactor, user, userPermissions, userRoles } from "@/db/schema";
import type { Permiso } from "@/domain/permisos";
import { auth } from "@/lib/auth";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Gestión de usuarios (spec/03 §4). Toda función exige permiso del módulo `usuarios`.

/** Dominio reservado (RFC 2606): usuarios sin email real. Nunca se les envía correo. */
export const SIN_EMAIL = "@sin-email.invalid";



const passwordTemporal = () => randomBytes(9).toString("base64url");

export async function listarUsuarios() {
  await requirePermiso("usuarios", "leer");
  const [us, rs] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        telefono: user.telefono,
        activo: user.activo,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .orderBy(asc(user.name)),
    db.select({ userId: userRoles.userId, nombre: roles.nombre }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)),
  ]);
  return us.map((u) => ({
    ...u,
    email: u.email.endsWith(SIN_EMAIL) ? null : u.email,
    roles: rs.filter((r) => r.userId === u.id).map((r) => r.nombre),
  }));
}

export async function obtenerUsuario(id: string) {
  await requirePermiso("usuarios", "leer");
  const [u] = await db.select().from(user).where(eq(user.id, id));
  if (!u) return null;
  const [rs, ps] = await Promise.all([
    db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id)),
    db.select().from(userPermissions).where(eq(userPermissions.userId, id)),
  ]);
  return {
    ...u,
    email: u.email.endsWith(SIN_EMAIL) ? null : u.email,
    roleIds: rs.map((r) => r.roleId),
    permisos: ps.map(({ modulo, accion, alcance }) => ({ modulo, accion, alcance }) as Permiso),
  };
}

type DatosUsuario = {
  name: string;
  username: string;
  email: string | null;
  telefono: string | null;
  roleIds: string[];
  permisos: Permiso[];
};

async function idsAdmin() {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(user, eq(user.id, userRoles.userId))
    .where(and(eq(roles.esSistema, true), eq(user.activo, true)));
  return rows.map((r) => r.userId);
}

async function rolesAdmin() {
  return (await db.select({ id: roles.id }).from(roles).where(eq(roles.esSistema, true))).map((r) => r.id);
}

/** Impide dejar el sistema sin administradores activos (RF-USR-04). */
async function verificarUltimoAdmin(userId: string, sigueSiendoAdmin: boolean) {
  if (sigueSiendoAdmin) return;
  const admins = await idsAdmin();
  if (admins.length === 1 && admins[0] === userId) {
    throw new ErrorNegocio("Tiene que quedar al menos un administrador activo.");
  }
}

async function usernameLibre(username: string, excepto?: string) {
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
  if (u && u.id !== excepto) throw new ErrorNegocio(`El usuario "${username}" ya existe.`);
}

export async function crearUsuario(d: DatosUsuario) {
  const { usuario: actor } = await requirePermiso("usuarios", "escribir");
  const username = d.username.toLowerCase();
  await usernameLibre(username);
  const email = (d.email || `${username}${SIN_EMAIL}`).toLowerCase();
  const [existeEmail] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existeEmail) throw new ErrorNegocio("Ya hay un usuario con ese email.");

  const temporal = passwordTemporal();
  const hash = await (await auth.$context).password.hash(temporal);
  const id = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(user)
      .values({
        name: d.name,
        username,
        displayUsername: username,
        email,
        telefono: d.telefono,
        mustChangePassword: true,
      })
      .returning({ id: user.id });
    await tx.insert(account).values({ userId: u.id, accountId: u.id, providerId: "credential", password: hash });
    if (d.roleIds.length) await tx.insert(userRoles).values(d.roleIds.map((roleId) => ({ userId: u.id, roleId })));
    if (d.permisos.length) await tx.insert(userPermissions).values(d.permisos.map((p) => ({ ...p, userId: u.id })));
    return u.id;
  });
  await auditar({
    actorUserId: actor.id,
    action: "usuario.crear",
    entityType: "usuario",
    entityId: id,
    entityLabel: username,
    diff: { roles: d.roleIds, permisos: d.permisos },
  });
  return { id, temporal };
}

export async function actualizarUsuario(id: string, d: DatosUsuario) {
  const { usuario: actor } = await requirePermiso("usuarios", "escribir");
  const antes = await obtenerUsuario(id);
  if (!antes) throw new ErrorNegocio("El usuario no existe.");
  const username = d.username.toLowerCase();
  await usernameLibre(username, id);
  const admin = await rolesAdmin();
  await verificarUltimoAdmin(id, d.roleIds.some((r) => admin.includes(r)));

  const email = (d.email || `${username}${SIN_EMAIL}`).toLowerCase();
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: d.name,
        username,
        displayUsername: username,
        email,
        telefono: d.telefono,
        // Un email nuevo hay que volver a verificarlo.
        ...(email !== (antes.email ?? "").toLowerCase() ? { emailVerified: false } : {}),
      })
      .where(eq(user.id, id));
    await tx.delete(userRoles).where(eq(userRoles.userId, id));
    if (d.roleIds.length) await tx.insert(userRoles).values(d.roleIds.map((roleId) => ({ userId: id, roleId })));
    await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
    if (d.permisos.length) await tx.insert(userPermissions).values(d.permisos.map((p) => ({ ...p, userId: id })));
  });
  await auditar({
    actorUserId: actor.id,
    action: "usuario.actualizar",
    entityType: "usuario",
    entityId: id,
    entityLabel: username,
    diff: {
      name: [antes.name, d.name],
      email: [antes.email, d.email],
      roles: [antes.roleIds, d.roleIds],
      permisos: [antes.permisos, d.permisos],
    },
  });
}

export async function cambiarActivo(id: string, activo: boolean) {
  const { usuario: actor } = await requirePermiso("usuarios", "escribir");
  if (!activo) {
    if (id === actor.id) throw new ErrorNegocio("No podés desactivar tu propio usuario.");
    await verificarUltimoAdmin(id, false);
  }
  await db.update(user).set({ activo }).where(eq(user.id, id));
  // Desactivar corta el acceso de inmediato (RF-USR-03).
  if (!activo) await db.delete(session).where(eq(session.userId, id));
  await auditar({ actorUserId: actor.id, action: activo ? "usuario.activar" : "usuario.desactivar", entityType: "usuario", entityId: id });
}

/** Genera una contraseña temporal; el usuario la cambia al entrar (spec/03 §3). */
export async function resetearPassword(id: string) {
  const { usuario: actor } = await requirePermiso("usuarios", "escribir");
  const temporal = passwordTemporal();
  const hash = await (await auth.$context).password.hash(temporal);
  await db.update(account).set({ password: hash }).where(and(eq(account.userId, id), eq(account.providerId, "credential")));
  await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, id));
  await db.delete(session).where(eq(session.userId, id));
  await auditar({ actorUserId: actor.id, action: "usuario.reset_password", entityType: "usuario", entityId: id });
  return temporal;
}

/** Quita el 2FA; si el rol lo exige, se le pide configurarlo de nuevo al entrar. */
export async function resetear2fa(id: string) {
  const { usuario: actor } = await requirePermiso("usuarios", "escribir");
  await db.delete(twoFactor).where(eq(twoFactor.userId, id));
  await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, id));
  await db.delete(session).where(eq(session.userId, id));
  await auditar({ actorUserId: actor.id, action: "usuario.reset_2fa", entityType: "usuario", entityId: id });
}

/** Cantidad de usuarios por rol (para la lista de roles). */
export async function usuariosPorRol(roleIds: string[]) {
  if (!roleIds.length) return new Map<string, number>();
  const rows = await db
    .select({ roleId: userRoles.roleId, n: count() })
    .from(userRoles)
    .where(inArray(userRoles.roleId, roleIds))
    .groupBy(userRoles.roleId);
  return new Map(rows.map((r) => [r.roleId, r.n]));
}
