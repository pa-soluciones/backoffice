import {
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Tablas de Better Auth (generadas con `pnpm dlx auth generate`, timestamps pasados a timestamptz).
export * from "./auth-schema";

const ts = (name?: string) =>
  (name ? timestamp(name, { withTimezone: true }) : timestamp({ withTimezone: true })).notNull().defaultNow();

// Datos de empresa, defaults y ajustes generales (spec/13-modelo-datos.md).
export const configuracion = pgTable("configuracion", {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  updatedAt: ts(),
});

// ── Roles y permisos (spec/03 §5) ─────────────────────────────────────────────

export const roles = pgTable("roles", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull().unique(),
  descripcion: text(),
  esSistema: boolean().notNull().default(false),
  requiere2fa: boolean().notNull().default(false),
  createdAt: ts(),
});

const permisoCols = {
  modulo: text().notNull(),
  accion: text().notNull(),
  alcance: text().$type<"todos" | "asignados">().notNull().default("todos"),
};

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    ...permisoCols,
  },
  (t) => [primaryKey({ columns: [t.roleId, t.modulo, t.accion] })],
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...permisoCols,
  },
  (t) => [primaryKey({ columns: [t.userId, t.modulo, t.accion] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

// ── Recuperación del admin (spec/03 §1, §3) ───────────────────────────────────

export const recoverySecrets = pgTable("recovery_secrets", {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fraseHash: text().notNull(),
  email: text().notNull(),
  emailVerificadoAt: timestamp({ withTimezone: true }),
  updatedAt: ts(),
});

// ── Auditoría (spec/03 §6): append-only ───────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    at: ts(),
    actorUserId: uuid().references(() => user.id),
    source: text().$type<"ui" | "mcp" | "cron" | "system">().notNull(),
    action: text().notNull(),
    entityType: text(),
    entityId: text(),
    entityLabel: text(),
    diff: jsonb(),
    ip: text(),
    userAgent: text(),
  },
  (t) => [index().on(t.entityType, t.entityId, t.at), index().on(t.actorUserId, t.at)],
);
