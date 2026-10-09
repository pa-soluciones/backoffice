import "server-only";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clientes, directoresObra, obras } from "@/db/schema";
import { alcanceDe } from "@/domain/permisos";
import { getPermisos, requireUsuario } from "./sesion";

// Buscador global (spec/04 §6): sin acentos ni mayúsculas, tolerante a errores de tipeo.

export type Resultado = { tipo: "cliente" | "obra" | "director"; id: string; titulo: string; detalle: string | null; href: string };

const LIMITE = 6;

/** Coincidencia: "contiene" (usa el índice trigram) o similitud por palabra ≥ 0,45 (typos). */
function coincide(col: AnyPgColumn, q: string): { where: SQL; orden: SQL<number> } {
  const c = sql`f_unaccent(lower(${col}))`;
  const t = sql`f_unaccent(lower(${q}))`;
  return {
    where: sql`(${c} like '%' || ${t} || '%' or word_similarity(${t}, ${c}) >= 0.45)`,
    orden: sql<number>`word_similarity(${t}, ${c})`,
  };
}

export async function buscar(texto: string): Promise<Resultado[]> {
  const usuario = await requireUsuario();
  const q = texto.trim().slice(0, 100);
  if (q.length < 2) return [];
  const permisos = await getPermisos(usuario.id);
  const verClientes = !!alcanceDe(permisos, "clientes", "leer");
  // ponytail: alcance "asignados" de obras se resuelve con presupuestos (F3).
  const verObras = alcanceDe(permisos, "obras", "leer") === "todos";

  const cli = coincide(clientes.razonSocial, q);
  const obr = coincide(obras.direccion, q);
  const obrNombre = coincide(obras.nombre, q);
  const dir = coincide(directoresObra.nombre, q);

  const [cs, os, ds] = await Promise.all([
    verClientes
      ? db
          .select({ id: clientes.id, titulo: clientes.razonSocial, archivado: clientes.archivado })
          .from(clientes)
          .where(and(isNull(clientes.deletedAt), cli.where))
          .orderBy(desc(cli.orden))
          .limit(LIMITE)
      : [],
    verObras
      ? db
          .select({ id: obras.id, titulo: obras.direccion, clienteId: clientes.id, cliente: clientes.razonSocial, director: directoresObra.nombre })
          .from(obras)
          .innerJoin(clientes, eq(clientes.id, obras.clienteId))
          .leftJoin(directoresObra, eq(directoresObra.id, obras.directorId))
          .where(and(isNull(obras.deletedAt), sql`(${obr.where} or ${obrNombre.where} or ${dir.where})`))
          .orderBy(desc(sql`greatest(${obr.orden}, coalesce(${obrNombre.orden}, 0), coalesce(${dir.orden}, 0))`))
          .limit(LIMITE)
      : [],
    verClientes
      ? db
          .select({ id: directoresObra.id, titulo: directoresObra.nombre, empresa: directoresObra.empresa })
          .from(directoresObra)
          .where(and(isNull(directoresObra.deletedAt), dir.where))
          .orderBy(desc(dir.orden))
          .limit(LIMITE)
      : [],
  ]);

  return [
    ...cs.map((c) => ({ tipo: "cliente" as const, id: c.id, titulo: c.titulo, detalle: c.archivado ? "Archivado" : null, href: `/explorador/${c.id}` })),
    ...os.map((o) => ({
      tipo: "obra" as const,
      id: o.id,
      titulo: o.titulo,
      detalle: [o.cliente, o.director && `Dir.: ${o.director}`].filter(Boolean).join(" · "),
      href: `/explorador/${o.clienteId}/${o.id}`,
    })),
    ...ds.map((d) => ({ tipo: "director" as const, id: d.id, titulo: d.titulo, detalle: d.empresa, href: `/directores/${d.id}` })),
  ];
}
