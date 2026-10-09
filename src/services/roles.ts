import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, roles } from "@/db/schema";
import type { Permiso } from "@/domain/permisos";
import { auditar } from "./auditoria";
import { requirePermiso } from "./sesion";
import { ErrorNegocio, usuariosPorRol } from "./usuarios";

// Roles y sus permisos (spec/03 §5). El rol de sistema (Administrador) no se edita ni se elimina.

export async function listarRoles() {
  await requirePermiso("roles", "leer");
  const rs = await db.select().from(roles).orderBy(asc(roles.nombre));
  const n = await usuariosPorRol(rs.map((r) => r.id));
  return rs.map((r) => ({ ...r, usuarios: n.get(r.id) ?? 0 }));
}

/** Para selects de usuarios: no exige permiso de roles, sí de usuarios. */
export async function opcionesRoles() {
  await requirePermiso("usuarios", "leer");
  return db.select({ id: roles.id, nombre: roles.nombre, esSistema: roles.esSistema }).from(roles).orderBy(asc(roles.nombre));
}

export async function obtenerRol(id: string) {
  await requirePermiso("roles", "leer");
  const [r] = await db.select().from(roles).where(eq(roles.id, id));
  if (!r) return null;
  const ps = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, id));
  return { ...r, permisos: ps.map(({ modulo, accion, alcance }) => ({ modulo, accion, alcance }) as Permiso) };
}

type DatosRol = { nombre: string; descripcion: string | null; requiere2fa: boolean; permisos: Permiso[] };

async function nombreLibre(nombre: string, excepto?: string) {
  const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.nombre, nombre));
  if (r && r.id !== excepto) throw new ErrorNegocio(`Ya existe un rol "${nombre}".`);
}

export async function crearRol(d: DatosRol) {
  const { usuario } = await requirePermiso("roles", "escribir");
  await nombreLibre(d.nombre);
  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(roles)
      .values({ nombre: d.nombre, descripcion: d.descripcion, requiere2fa: d.requiere2fa })
      .returning({ id: roles.id });
    if (d.permisos.length) await tx.insert(rolePermissions).values(d.permisos.map((p) => ({ ...p, roleId: r.id })));
    return r.id;
  });
  await auditar({ actorUserId: usuario.id, action: "rol.crear", entityType: "rol", entityId: id, entityLabel: d.nombre, diff: { permisos: d.permisos } });
  return id;
}

export async function actualizarRol(id: string, d: DatosRol) {
  const { usuario } = await requirePermiso("roles", "escribir");
  const antes = await obtenerRol(id);
  if (!antes) throw new ErrorNegocio("El rol no existe.");
  if (antes.esSistema) throw new ErrorNegocio("El rol Administrador no se puede modificar.");
  await nombreLibre(d.nombre, id);
  await db.transaction(async (tx) => {
    await tx.update(roles).set({ nombre: d.nombre, descripcion: d.descripcion, requiere2fa: d.requiere2fa }).where(eq(roles.id, id));
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (d.permisos.length) await tx.insert(rolePermissions).values(d.permisos.map((p) => ({ ...p, roleId: id })));
  });
  await auditar({
    actorUserId: usuario.id,
    action: "rol.actualizar",
    entityType: "rol",
    entityId: id,
    entityLabel: d.nombre,
    diff: { nombre: [antes.nombre, d.nombre], requiere2fa: [antes.requiere2fa, d.requiere2fa], permisos: [antes.permisos, d.permisos] },
  });
}

export async function eliminarRol(id: string) {
  const { usuario } = await requirePermiso("roles", "eliminar");
  const r = await obtenerRol(id);
  if (!r) return;
  if (r.esSistema) throw new ErrorNegocio("El rol Administrador no se puede eliminar.");
  const n = (await usuariosPorRol([id])).get(id) ?? 0;
  if (n > 0) throw new ErrorNegocio(`El rol tiene ${n} usuario(s). Quitáselo antes de eliminarlo.`);
  await db.delete(roles).where(eq(roles.id, id));
  await auditar({ actorUserId: usuario.id, action: "rol.eliminar", entityType: "rol", entityId: id, entityLabel: r.nombre, diff: { permisos: r.permisos } });
}
