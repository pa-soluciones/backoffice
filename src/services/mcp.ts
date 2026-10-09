import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { mcpTokens, mcpUso, user } from "@/db/schema";
import { auditar } from "./auditoria";
import type { ContextoMcp } from "./contexto";
import { ErrorNegocio } from "./errores";
import { requirePermiso, requireUsuario, type Usuario } from "./sesion";

// Tokens personales para el servidor MCP (spec/11 RF-MCP-02..04).

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const LIMITE_POR_MINUTO = 60;
export const VIGENCIAS = [30, 90, 365] as const;

export async function crearToken(nombre: string, dias: number) {
  const { usuario } = await requirePermiso("mcp", "escribir");
  if (!nombre.trim()) throw new ErrorNegocio("Poné un nombre para reconocerlo (ej. “Claude Desktop notebook”).");
  if (!(VIGENCIAS as readonly number[]).includes(dias)) throw new ErrorNegocio("Elegí un vencimiento válido.");
  const token = `pas_${randomBytes(32).toString("base64url")}`;
  const [t] = await db
    .insert(mcpTokens)
    .values({ userId: usuario.id, nombre: nombre.trim().slice(0, 80), tokenHash: hash(token), ultimos4: token.slice(-4), expiresAt: new Date(Date.now() + dias * 86_400_000) })
    .returning({ id: mcpTokens.id });
  await auditar({ actorUserId: usuario.id, action: "mcp.token_crear", entityType: "mcp_token", entityId: t.id, entityLabel: nombre, diff: { dias } });
  return token; // única vez que se ve en claro
}

export async function misTokens() {
  const u = await requireUsuario();
  return db
    .select({ id: mcpTokens.id, nombre: mcpTokens.nombre, ultimos4: mcpTokens.ultimos4, expiresAt: mcpTokens.expiresAt, revokedAt: mcpTokens.revokedAt, lastUsedAt: mcpTokens.lastUsedAt, lastUsedIp: mcpTokens.lastUsedIp, createdAt: mcpTokens.createdAt })
    .from(mcpTokens)
    .where(eq(mcpTokens.userId, u.id))
    .orderBy(desc(mcpTokens.createdAt))
    .then((ts) => ts.map((t) => ({ ...t, activo: !t.revokedAt && t.expiresAt > new Date() })));
}

export async function revocarToken(id: string) {
  const u = await requireUsuario();
  const [t] = await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, u.id), isNull(mcpTokens.revokedAt)))
    .returning({ nombre: mcpTokens.nombre });
  if (t) await auditar({ actorUserId: u.id, action: "mcp.token_revocar", entityType: "mcp_token", entityId: id, entityLabel: t.nombre });
}

export type Autenticacion = { ok: true; contexto: ContextoMcp } | { ok: false; status: 401 | 429; mensaje: string };

/** Valida `Bearer pas_…`: vigente, no revocado, usuario activo y dentro del límite por minuto. */
export async function autenticarToken(bearer: string | null, ip: string | null): Promise<Autenticacion> {
  const token = bearer?.match(/^Bearer\s+(pas_[\w-]+)$/)?.[1];
  if (!token) return { ok: false, status: 401, mensaje: "Falta el token (Authorization: Bearer pas_…)." };
  const [fila] = await db.select({ t: mcpTokens, u: user }).from(mcpTokens).innerJoin(user, eq(user.id, mcpTokens.userId)).where(eq(mcpTokens.tokenHash, hash(token)));
  if (!fila || fila.t.revokedAt || fila.t.expiresAt < new Date() || !fila.u.activo) return { ok: false, status: 401, mensaje: "Token inválido, vencido o revocado." };

  const minuto = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const [uso] = await db
    .insert(mcpUso)
    .values({ tokenId: fila.t.id, minuto, llamadas: 1 })
    .onConflictDoUpdate({ target: [mcpUso.tokenId, mcpUso.minuto], set: { llamadas: sql`${mcpUso.llamadas} + 1` } })
    .returning({ llamadas: mcpUso.llamadas });
  if (uso.llamadas > LIMITE_POR_MINUTO) return { ok: false, status: 429, mensaje: `Más de ${LIMITE_POR_MINUTO} llamadas por minuto. Esperá un momento.` };

  await db.update(mcpTokens).set({ lastUsedAt: new Date(), lastUsedIp: ip }).where(eq(mcpTokens.id, fila.t.id));
  return { ok: true, contexto: { usuario: fila.u as unknown as Usuario, tokenId: fila.t.id, tokenNombre: fila.t.nombre, ip } };
}
