import "server-only";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

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
  const h = await headers().catch(() => null);
  await db.insert(auditLog).values({
    source: "ui",
    ...e,
    ip: h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h?.get("user-agent") ?? null,
  });
}
