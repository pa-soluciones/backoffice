import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
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

// ── Presupuestos (spec/05) ────────────────────────────────────────────────────

/** Montos en numeric(14,2): Drizzle los devuelve como string; se convierten en el servicio. */
const monto = () => numeric({ precision: 14, scale: 2 });

export const numeracionAnual = pgTable("numeracion_anual", {
  anio: integer().primaryKey(),
  proximoNumero: integer().notNull(),
});

export const presupuestos = pgTable(
  "presupuestos",
  {
    id: uuid().primaryKey().defaultRandom(),
    anio: integer(),
    numero: integer(),
    clienteId: uuid().references(() => clientes.id),
    obraId: uuid().references(() => obras.id),
    estado: text().notNull().default("prospecto"),
    estadoAnterior: text(),
    requiereVisita: boolean().notNull().default(false),
    moneda: text().$type<"ARS" | "USD">().notNull().default("ARS"),
    tipoCambioRef: numeric({ precision: 14, scale: 4 }),
    incluyeIva: boolean().notNull().default(false),
    ivaPct: numeric({ precision: 5, scale: 2 }).notNull().default("21"),
    validezDias: integer().notNull().default(7),
    formaContratacion: text().notNull().default("Ajuste Alzado"),
    baseAjuste: text().notNull().default("CAC General"),
    anticipoPct: numeric({ precision: 5, scale: 2 }).notNull().default("40"),
    bonifTipo: text().$type<"pct" | "monto">(),
    bonifValor: numeric({ precision: 14, scale: 4 }),
    fechaConfirmacion: date(),
    motivoCierre: text(),
    // Prospecto (puede no tener cliente todavía).
    contactoNombre: text(),
    contactoTelefono: text(),
    contactoEmail: text(),
    origen: text(),
    pedido: text(),
    ...auditoriaCols,
  },
  (t) => [
    uniqueIndex().on(t.anio, t.numero),
    index().on(t.estado, t.updatedAt),
    index().on(t.obraId),
    index().on(t.clienteId),
  ],
);

export const presupuestoRevisiones = pgTable(
  "presupuesto_revisiones",
  {
    id: uuid().primaryKey().defaultRandom(),
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id),
    nro: integer().notNull(),
    estado: text().$type<"borrador" | "emitida" | "reemplazada">().notNull().default("borrador"),
    emitidaAt: timestamp({ withTimezone: true }),
    emitidaPor: uuid().references(() => user.id),
    /** Totales congelados al emitir (JSON de calcularTotales). */
    totales: jsonb(),
    createdAt: ts(),
  },
  (t) => [uniqueIndex().on(t.presupuestoId, t.nro)],
);

export const adicionales = pgTable(
  "adicionales",
  {
    id: uuid().primaryKey().defaultRandom(),
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id),
    nro: integer().notNull(),
    estado: text().$type<"borrador" | "enviado" | "aprobado" | "rechazado" | "cancelado">().notNull().default("borrador"),
    moneda: text().$type<"ARS" | "USD">().notNull(),
    validezDias: integer().notNull().default(15),
    anticipoPct: numeric({ precision: 5, scale: 2 }).notNull().default("0"),
    mantieneBonificacion: boolean().notNull().default(false),
    /** Totales congelados al emitir. */
    totales: jsonb(),
    emitidoAt: timestamp({ withTimezone: true }),
    aprobadoAt: timestamp({ withTimezone: true }),
    motivo: text(),
    createdBy: uuid().references(() => user.id),
    createdAt: ts(),
    updatedAt: ts(),
  },
  (t) => [uniqueIndex().on(t.presupuestoId, t.nro)],
);

export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Ítem de una revisión del presupuesto o de un adicional (exactamente uno). */
    revisionId: uuid().references(() => presupuestoRevisiones.id, { onDelete: "cascade" }),
    adicionalId: uuid().references(() => adicionales.id, { onDelete: "cascade" }),
    nro: integer().notNull(),
    tipoServicio: text().notNull(),
    elemento: text(),
    diametroMm: numeric({ precision: 8, scale: 1 }),
    espesorCm: numeric({ precision: 8, scale: 1 }),
    unidad: text().notNull().default("u"),
    cantidad: numeric({ precision: 12, scale: 2 }).notNull(),
    precioUnitario: monto().notNull(),
    descripcion: text().notNull(),
    descripcionManual: boolean().notNull().default(false),
  },
  (t) => [
    index().on(t.revisionId, t.nro),
    index().on(t.adicionalId, t.nro),
    check("items_un_duenio", sql`(${t.revisionId} is null) <> (${t.adicionalId} is null)`),
  ],
);

export const presupuestoAsignados = pgTable(
  "presupuesto_asignados",
  {
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rolTrabajo: text().$type<"responsable" | "operario">().notNull().default("operario"),
  },
  (t) => [primaryKey({ columns: [t.presupuestoId, t.userId] }), index().on(t.userId)],
);

export const estadoHistorial = pgTable(
  "estado_historial",
  {
    id: uuid().primaryKey().defaultRandom(),
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id),
    desde: text(),
    hasta: text().notNull(),
    motivo: text(),
    userId: uuid().references(() => user.id),
    at: ts(),
  },
  (t) => [index().on(t.presupuestoId, t.at)],
);

export const visitas = pgTable(
  "visitas",
  {
    id: uuid().primaryKey().defaultRandom(),
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id),
    inicio: timestamp({ withTimezone: true }),
    duracionMin: integer().notNull().default(60),
    direccion: text(),
    contactoSitio: text(),
    estado: text().$type<"pendiente" | "agendada" | "realizada" | "omitida" | "cancelada">().notNull().default("pendiente"),
    notasPrevias: text(),
    notasResultado: text(),
    motivoOmision: text(),
    createdAt: ts(),
    updatedAt: ts(),
  },
  (t) => [index().on(t.presupuestoId), index().on(t.inicio)],
);

export const visitaResponsables = pgTable(
  "visita_responsables",
  {
    visitaId: uuid()
      .notNull()
      .references(() => visitas.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.visitaId, t.userId] })],
);

// ── Archivos en R2 y cuota del free tier ──────────────────────────────────────

/** Cada objeto guardado en R2. Lo pendiente (subida en curso) también reserva espacio. */
export const archivos = pgTable(
  "archivos",
  {
    id: uuid().primaryKey().defaultRandom(),
    r2Key: text().notNull().unique(),
    nombre: text().notNull(),
    mime: text().notNull(),
    bytes: bigint({ mode: "number" }).notNull(),
    sha256: text(),
    estado: text().$type<"pendiente" | "ok">().notNull().default("pendiente"),
    entidadTipo: text(),
    entidadId: text(),
    categoria: text(),
    descripcion: text(),
    createdBy: uuid().references(() => user.id),
    createdAt: ts(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.entidadTipo, t.entidadId)],
);

export const r2UsoMensual = pgTable("r2_uso_mensual", {
  /** "2026-10" (mes UTC, como factura Cloudflare). */
  mes: text().primaryKey(),
  opsA: bigint({ mode: "number" }).notNull().default(0),
  opsB: bigint({ mode: "number" }).notNull().default(0),
  /** Límites ampliados por un admin para este mes: { almacenamiento?, opsA?, opsB? }. */
  aprobado: jsonb(),
  aprobadoPor: uuid().references(() => user.id),
  aprobadoAt: timestamp({ withTimezone: true }),
  /** Recursos ya avisados a los admins este mes (para no repetir el email). */
  avisados: jsonb().$type<string[]>().notNull().default([]),
});

// ── Documentos (spec/06) ──────────────────────────────────────────────────────

export const documentos = pgTable(
  "documentos",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text().$type<"presupuesto" | "adicional">().notNull(),
    presupuestoId: uuid()
      .notNull()
      .references(() => presupuestos.id),
    /** Documento de presupuesto: uno por revisión. */
    revisionId: uuid().references(() => presupuestoRevisiones.id),
    /** Documento de un trabajo adicional: uno por adicional. */
    adicionalId: uuid().references(() => adicionales.id),
    estado: text().$type<"borrador" | "emitido">().notNull().default("borrador"),
    /** Bloques de texto editables vigentes: { bloqueId: texto }. */
    bloques: jsonb().$type<Record<string, string>>().notNull(),
    version: integer().notNull().default(1),
    emitidoAt: timestamp({ withTimezone: true }),
    emitidoPor: uuid().references(() => user.id),
    /** Datos resueltos al emitir (lo que se imprimió). */
    snapshot: jsonb(),
    docxArchivoId: uuid().references(() => archivos.id),
    pdfArchivoId: uuid().references(() => archivos.id),
    pdfEstado: text().$type<"ok" | "pendiente">(),
    createdAt: ts(),
    updatedAt: ts(),
  },
  (t) => [uniqueIndex().on(t.revisionId), uniqueIndex().on(t.adicionalId), index().on(t.presupuestoId)],
);

export const documentoVersiones = pgTable(
  "documento_versiones",
  {
    id: uuid().primaryKey().defaultRandom(),
    documentoId: uuid()
      .notNull()
      .references(() => documentos.id, { onDelete: "cascade" }),
    nro: integer().notNull(),
    bloques: jsonb().$type<Record<string, string>>().notNull(),
    origen: text().$type<"usuario" | "ia" | "mcp" | "sistema">().notNull(),
    userId: uuid().references(() => user.id),
    at: ts(),
  },
  (t) => [uniqueIndex().on(t.documentoId, t.nro)],
);

// ── IA (spec/10 §5): registro de cada llamada para costos y tope mensual ──────

export const iaUso = pgTable(
  "ia_uso",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => user.id),
    funcion: text().notNull(),
    modelo: text().notNull(),
    tokensEntrada: integer().notNull(),
    tokensSalida: integer().notNull(),
    costoUsd: numeric({ precision: 10, scale: 6 }).notNull(),
    ms: integer().notNull(),
    documentoId: uuid().references(() => documentos.id),
    at: ts(),
  },
  (t) => [index().on(t.at)],
);
