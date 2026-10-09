import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  uniqueIndex,
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

// ── Clientes, directores y obras (spec/04) ────────────────────────────────────
// f_unaccent: wrapper inmutable de unaccent (migración 0004) para indexar búsquedas sin acentos.
const norm = (col: string) => sql.raw(`f_unaccent(lower(${col}))`);

const auditoriaCols = {
  createdAt: ts(),
  updatedAt: ts(),
  createdBy: uuid().references(() => user.id),
  deletedAt: timestamp({ withTimezone: true }),
};

export const clientes = pgTable(
  "clientes",
  {
    id: uuid().primaryKey().defaultRandom(),
    razonSocial: text().notNull(),
    cuit: text(),
    telefono: text(),
    email: text(),
    notas: text(),
    archivado: boolean().notNull().default(false),
    ...auditoriaCols,
  },
  () => [
    uniqueIndex("clientes_razon_social_uq").on(norm("razon_social")).where(sql`deleted_at is null`),
    index("clientes_razon_social_trgm").using("gin", sql`${norm("razon_social")} gin_trgm_ops`),
  ],
);

export const directoresObra = pgTable(
  "directores_obra",
  {
    id: uuid().primaryKey().defaultRandom(),
    nombre: text().notNull(),
    telefono: text(),
    email: text(),
    empresa: text(),
    notas: text(),
    ...auditoriaCols,
  },
  () => [index("directores_nombre_trgm").using("gin", sql`${norm("nombre")} gin_trgm_ops`)],
);

export const obras = pgTable(
  "obras",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id),
    nombre: text(),
    /** Como se imprime en los documentos: "Av. Córdoba 1234, CABA". */
    direccion: text().notNull(),
    localidad: text(),
    provincia: text(),
    directorId: uuid().references(() => directoresObra.id),
    hysNombre: text(),
    notas: text(),
    ...auditoriaCols,
  },
  (t) => [
    index().on(t.clienteId),
    index().on(t.directorId),
    index("obras_direccion_trgm").using("gin", sql`${norm("direccion")} gin_trgm_ops`),
  ],
);
