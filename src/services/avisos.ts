import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recoverySecrets, roles, user, userRoles } from "@/db/schema";
import { enviarEmail } from "@/lib/email";

type Contenido = Parameters<typeof enviarEmail>[2];

/** Email a todos los administradores activos (al correo de recuperación si lo tienen). Nunca lanza. */
export async function emailAAdmins(asunto: string, contenido: Contenido) {
  const admins = await db
    .select({ email: user.email, recEmail: recoverySecrets.email })
    .from(user)
    .innerJoin(userRoles, eq(userRoles.userId, user.id))
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.esSistema, true)))
    .leftJoin(recoverySecrets, eq(recoverySecrets.userId, user.id))
    .where(eq(user.activo, true));
  for (const to of new Set(admins.map((a) => a.recEmail ?? a.email))) {
    await enviarEmail(to, asunto, contenido).catch((e) => console.error("[avisos] email a admin falló", e));
  }
}
