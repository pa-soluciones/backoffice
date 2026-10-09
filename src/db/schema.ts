import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Datos de empresa, defaults y ajustes generales (spec/13-modelo-datos.md).
export const configuracion = pgTable("configuracion", {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
