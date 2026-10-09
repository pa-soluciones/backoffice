import "server-only";
import { and, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog, user } from "@/db/schema";
import { contextoMcp } from "./contexto";
import { requirePermiso } from "./sesion";

type Evento = {
  actorUserId?: string | null;
  source?: "ui" | "mcp" | "cron" | "system";
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  diff?: Record<string, unknown>;
};

/** Registra un evento de auditoría con IP y user agent del request actual (spec/03 §6). */
export async function auditar(e: Evento) {
  // Fuera de un request (cron, tests) no hay headers: se audita igual, sin IP.
  let h: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    h = await headers();
  } catch {}
  const mcp = contextoMcp();
  await db.insert(auditLog).values({
    source: "ui",
    ...e,
    ...(mcp ? { source: "mcp" as const, mcpTokenId: mcp.tokenId, diff: { ...e.diff, token: mcp.tokenNombre } } : {}),
    ip: mcp?.ip ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: mcp ? "mcp" : (h?.get("user-agent") ?? null),
  });
}

export const POR_PAGINA = 50;

export type FiltroAuditoria = {
  usuarioId?: string;
  accion?: string;
  entidad?: string;
  desde?: string; // yyyy-mm-dd (hora Argentina)
  hasta?: string;
  pagina?: number;
};

/** Consulta de auditoría, más reciente primero (RF-AUD-02). */
export async function listarAuditoria(f: FiltroAuditoria) {
  await requirePermiso("auditoria", "leer");
  const cond = [
    f.usuarioId ? eq(auditLog.actorUserId, f.usuarioId) : undefined,
    f.accion ? ilike(auditLog.action, `%${f.accion}%`) : undefined,
    f.entidad ? or(ilike(auditLog.entityLabel, `%${f.entidad}%`), eq(auditLog.entityId, f.entidad)) : undefined,
    f.desde ? gte(auditLog.at, new Date(`${f.desde}T00:00:00-03:00`)) : undefined,
    f.hasta ? lt(auditLog.at, new Date(new Date(`${f.hasta}T00:00:00-03:00`).getTime() + 86_400_000)) : undefined,
  ];
  const pagina = Math.max(1, f.pagina ?? 1);
  const filas = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      source: auditLog.source,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityLabel: auditLog.entityLabel,
      diff: auditLog.diff,
      ip: auditLog.ip,
      actor: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .where(and(...cond))
    .orderBy(desc(auditLog.id))
    .limit(POR_PAGINA + 1)
    .offset((pagina - 1) * POR_PAGINA);
  return { filas: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA, pagina };
}
