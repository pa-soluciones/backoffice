import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { account, rolePermissions, roles, user, userRoles } from "@/db/schema";
import type { Permiso } from "@/domain/permisos";
import { auth } from "@/lib/auth";
import { auditar } from "./auditoria";

// Roles sugeridos (spec/03 §5.3), editables por el admin.
const ROLES_SEED: { nombre: string; descripcion: string; permisos: Omit<Permiso, "alcance">[]; alcance: "todos" | "asignados" }[] = [
  {
    nombre: "Comercial",
    descripcion: "Clientes, obras, presupuestos y documentos",
    alcance: "todos",
    permisos: [
      ...(["clientes", "obras", "presupuestos", "documentos", "agenda", "anexos", "cobros"] as const).map((modulo) => ({
        modulo,
        accion: "escribir" as const,
      })),
      { modulo: "presupuestos", accion: "cambiar_estado" },
      { modulo: "presupuestos", accion: "ver_montos" },
      { modulo: "documentos", accion: "emitir" },
      { modulo: "finanzas", accion: "leer" },
    ],
  },
  {
    nombre: "Operario",
    descripcion: "Trabajo de campo en presupuestos asignados",
    alcance: "asignados",
    permisos: [
      { modulo: "presupuestos", accion: "leer" },
      { modulo: "campo", accion: "escribir" },
      { modulo: "agenda", accion: "leer" },
      { modulo: "anexos", accion: "escribir" },
      { modulo: "gastos", accion: "escribir" },
      { modulo: "stock", accion: "leer" },
    ],
  },
  {
    nombre: "Administración",
    descripcion: "Stock, gastos, cobros y finanzas",
    alcance: "todos",
    permisos: [
      { modulo: "stock", accion: "eliminar" },
      { modulo: "stock", accion: "ver_montos" },
      { modulo: "gastos", accion: "eliminar" },
      { modulo: "cobros", accion: "eliminar" },
      { modulo: "finanzas", accion: "leer" },
      { modulo: "presupuestos", accion: "ver_montos" },
    ],
  },
];

/**
 * Si la base no tiene usuarios, crea los roles y el admin inicial desde
 * ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD (spec/03 RF-AUTH-01).
 */
export async function asegurarAdminInicial() {
  const [{ n }] = await db.select({ n: count() }).from(user);
  if (n > 0) return;

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error("Faltan ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD");

  const ctx = await auth.$context;
  await db.transaction(async (tx) => {
    const [admin] = await tx
      .insert(roles)
      .values({ nombre: "Administrador", descripcion: "Acceso total", esSistema: true, requiere2fa: true })
      .returning();
    for (const r of ROLES_SEED) {
      const [rol] = await tx.insert(roles).values({ nombre: r.nombre, descripcion: r.descripcion }).returning();
      await tx.insert(rolePermissions).values(r.permisos.map((p) => ({ ...p, roleId: rol.id, alcance: r.alcance })));
    }

    const [u] = await tx
      .insert(user)
      .values({
        name: "Administrador",
        email: email.toLowerCase(),
        username: "admin",
        displayUsername: "admin",
        mustChangePassword: true,
        mustCompleteSetup: true,
      })
      .returning();
    await tx.insert(userRoles).values({ userId: u.id, roleId: admin.id });
    // Cuenta "credential" de Better Auth con la contraseña hasheada por su propio hasher.
    await tx.insert(account).values({
      userId: u.id,
      accountId: u.id,
      providerId: "credential",
      password: await ctx.password.hash(password),
    });
  });
  await auditar({ source: "system", action: "usuario.bootstrap_admin", entityType: "usuario", entityLabel: "admin" });
}
