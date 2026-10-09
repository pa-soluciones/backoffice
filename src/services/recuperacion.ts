import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, gt, like, or } from "drizzle-orm";
import { db } from "@/db";
import { account, recoverySecrets, session, twoFactor, user, verification } from "@/db/schema";
import { auth } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { auditar } from "./auditoria";
import { emailAAdmins } from "./avisos";

// Recuperación de acceso (spec/03 §3). Sin sesión: nunca revela si un usuario existe.

const VIGENCIA_MIN = 30;
const MAX_INTENTOS = 5;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const id = (token: string) => `reset:${sha(token)}`;
const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

type Dato = { userId: string; intentos: number };

/** Envía el link de recuperación si el usuario existe y tiene a dónde mandarlo. */
export async function solicitarRecuperacion(identificador: string) {
  const valor = identificador.trim().toLowerCase();
  const [u] = await db
    .select({ id: user.id, name: user.name, email: user.email, activo: user.activo, recEmail: recoverySecrets.email, recOk: recoverySecrets.emailVerificadoAt })
    .from(user)
    .leftJoin(recoverySecrets, eq(recoverySecrets.userId, user.id))
    .where(or(eq(user.username, valor), eq(user.email, valor), eq(recoverySecrets.email, valor)));
  if (!u?.activo) return;

  // Correo de recuperación verificado (admin) o el email propio si es real.
  const destino = u.recOk ? u.recEmail : u.email.endsWith(".invalid") ? null : u.email;
  if (!destino) return;

  // Anti-spam: un link vigente pedido hace menos de 2 minutos no se reenvía.
  const [reciente] = await db
    .select({ id: verification.id })
    .from(verification)
    .where(and(like(verification.identifier, "reset:%"), like(verification.value, `%"${u.id}"%`), gt(verification.createdAt, new Date(Date.now() - 2 * 60_000))));
  if (reciente) return;

  const token = randomBytes(32).toString("base64url");
  await db.insert(verification).values({
    identifier: id(token),
    value: JSON.stringify({ userId: u.id, intentos: 0 } satisfies Dato),
    expiresAt: new Date(Date.now() + VIGENCIA_MIN * 60_000),
  });
  await enviarEmail(destino, "Recuperar acceso · PAS Backoffice", {
    categoria: "Seguridad de la cuenta",
    titulo: "Recuperar acceso",
    parrafos: [`Hola ${u.name}, recibimos un pedido para restablecer tu contraseña. El link vence en ${VIGENCIA_MIN} minutos y sirve una sola vez.`],
    boton: { texto: "Elegir nueva contraseña", url: `${appUrl()}/recuperar/${token}` },
    nota: "Si no lo pediste, ignorá este correo: tu contraseña no cambia.",
  });
  await auditar({ source: "system", action: "auth.recuperacion_solicitada", entityType: "usuario", entityId: u.id });
}

async function leer(token: string) {
  const [v] = await db.select().from(verification).where(eq(verification.identifier, id(token)));
  if (!v || v.expiresAt < new Date()) return null;
  const dato = JSON.parse(v.value) as Dato;
  if (dato.intentos >= MAX_INTENTOS) return null;
  return { v, dato };
}

/** Para la pantalla: si el token sirve y si hay que pedir frase. */
export async function estadoToken(token: string) {
  const t = await leer(token);
  if (!t) return null;
  const [rs] = await db.select({ userId: recoverySecrets.userId }).from(recoverySecrets).where(eq(recoverySecrets.userId, t.dato.userId));
  return { pideFrase: !!rs };
}

export async function restablecer(token: string, nueva: string, frase: string | null, perdi2fa: boolean) {
  const t = await leer(token);
  if (!t) return { error: "El link venció o ya se usó. Pedí uno nuevo." };
  const { userId } = t.dato;

  const [rs] = await db.select().from(recoverySecrets).where(eq(recoverySecrets.userId, userId));
  if (rs && !(await verifyPassword({ hash: rs.fraseHash, password: (frase ?? "").trim() }))) {
    await db
      .update(verification)
      .set({ value: JSON.stringify({ ...t.dato, intentos: t.dato.intentos + 1 }) })
      .where(eq(verification.id, t.v.id));
    await auditar({ source: "system", action: "auth.recuperacion_frase_incorrecta", entityType: "usuario", entityId: userId });
    return { error: `La frase no coincide. Te quedan ${MAX_INTENTOS - t.dato.intentos - 1} intentos.` };
  }
  // Solo quien tiene frase puede resetear su 2FA solo; el resto lo pide a un admin.
  const reset2fa = !!rs && perdi2fa;

  const hash = await (await auth.$context).password.hash(nueva);
  await db.transaction(async (tx) => {
    await tx.update(account).set({ password: hash }).where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    await tx.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(verification).where(eq(verification.id, t.v.id));
    if (reset2fa) {
      await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
      await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, userId));
    }
  });
  await auditar({
    source: "system",
    action: reset2fa ? "auth.recuperacion_password_y_2fa" : "auth.recuperacion_password",
    entityType: "usuario",
    entityId: userId,
  });
  await avisarAdmins(userId, reset2fa);
  return { ok: true };
}

/** RF-AUTH-08: toda recuperación se notifica a los administradores. */
async function avisarAdmins(userId: string, reset2fa: boolean) {
  const [afectado] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  await emailAAdmins("Alerta de seguridad · PAS Backoffice", {
    categoria: "Alerta de seguridad",
    titulo: "Se recuperó el acceso de una cuenta",
    parrafos: [
      `${afectado?.name ?? "Un usuario"} restableció su contraseña${reset2fa ? " y quitó su verificación en dos pasos" : ""}.`,
      "Si no fue esa persona, desactivá el usuario desde Ajustes → Usuarios.",
    ],
    boton: { texto: "Ver auditoría", url: `${appUrl()}/ajustes/auditoria` },
  });
}
