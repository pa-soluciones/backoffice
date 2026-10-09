import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/db";
import { recoverySecrets, user, verification } from "@/db/schema";
import { auth } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { auditar } from "./auditoria";
import { getRoles, type Usuario } from "./sesion";

// Asistente obligatorio de primer inicio (spec/03 RF-AUTH-02). El paso se deriva de la base.

export type Paso = "password" | "recuperacion" | "verificar-email" | "2fa" | "listo";

export async function pasoActual(u: Usuario): Promise<Paso> {
  if (u.mustChangePassword) return "password";
  if (u.mustCompleteSetup) {
    const [rs] = await db.select().from(recoverySecrets).where(eq(recoverySecrets.userId, u.id));
    if (!rs) return "recuperacion";
    if (!rs.emailVerificadoAt) return "verificar-email";
  }
  const roles = await getRoles(u.id);
  if (!u.twoFactorEnabled && (u.mustCompleteSetup || roles.some((r) => r.requiere2fa))) return "2fa";
  return "listo";
}

/** Marca el asistente como completo cuando ya no quedan pasos. */
export async function finalizarSiCorresponde(u: Usuario) {
  if (u.mustCompleteSetup && (await pasoActual(u)) === "listo") {
    await db.update(user).set({ mustCompleteSetup: false }).where(eq(user.id, u.id));
    await auditar({ actorUserId: u.id, action: "usuario.configuracion_inicial_completa", entityType: "usuario", entityId: u.id });
  }
}

export async function cambiarPassword(u: Usuario, actual: string, nueva: string) {
  if (actual === nueva) return { error: "La nueva contraseña tiene que ser distinta de la actual." };
  try {
    await auth.api.changePassword({
      body: { currentPassword: actual, newPassword: nueva, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { error: "La contraseña actual no es correcta." };
  }
  await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, u.id));
  await auditar({ actorUserId: u.id, action: "usuario.password_cambiada", entityType: "usuario", entityId: u.id });
  return { ok: true };
}

// ── Correo de recuperación con código de 6 dígitos ────────────────────────────

const MAX_INTENTOS = 5;
const sha = (s: string) => createHash("sha256").update(s).digest();
const idVerif = (userId: string) => `email-recuperacion:${userId}`;

async function enviarCodigo(u: Usuario, email: string) {
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.delete(verification).where(eq(verification.identifier, idVerif(u.id)));
  await db.insert(verification).values({
    identifier: idVerif(u.id),
    value: JSON.stringify({ hash: sha(codigo).toString("hex"), intentos: 0 }),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  await enviarEmail(email, "Código de verificación · PAS Backoffice", {
    categoria: "Seguridad de la cuenta",
    titulo: "Verificá tu correo de recuperación",
    parrafos: [`Hola ${u.name}, ingresá este código en PAS Backoffice para confirmar este correo. Vence en 15 minutos.`],
    codigo,
    nota: "Si no pediste este código, ignorá este correo. Nadie de PAS te va a pedir este código por teléfono ni WhatsApp.",
  });
}

export async function guardarRecuperacion(u: Usuario, frase: string, email: string) {
  const fraseHash = await hashPassword(frase.trim());
  await db
    .insert(recoverySecrets)
    .values({ userId: u.id, fraseHash, email: email.toLowerCase() })
    .onConflictDoUpdate({
      target: recoverySecrets.userId,
      set: { fraseHash, email: email.toLowerCase(), emailVerificadoAt: null, updatedAt: new Date() },
    });
  await enviarCodigo(u, email);
  await auditar({ actorUserId: u.id, action: "usuario.recuperacion_configurada", entityType: "usuario", entityId: u.id });
}

export async function reenviarCodigo(u: Usuario) {
  const [rs] = await db.select().from(recoverySecrets).where(eq(recoverySecrets.userId, u.id));
  if (rs) await enviarCodigo(u, rs.email);
}

export async function verificarCodigoEmail(u: Usuario, codigo: string) {
  const [v] = await db.select().from(verification).where(eq(verification.identifier, idVerif(u.id)));
  if (!v || v.expiresAt < new Date()) return { error: "El código venció. Pedí uno nuevo." };
  const data = JSON.parse(v.value) as { hash: string; intentos: number };
  if (data.intentos >= MAX_INTENTOS) return { error: "Superaste los intentos. Pedí un código nuevo." };

  if (!timingSafeEqual(sha(codigo.trim()), Buffer.from(data.hash, "hex"))) {
    await db
      .update(verification)
      .set({ value: JSON.stringify({ ...data, intentos: data.intentos + 1 }) })
      .where(eq(verification.id, v.id));
    return { error: `Código incorrecto. Te quedan ${MAX_INTENTOS - data.intentos - 1} intentos.` };
  }
  await db.delete(verification).where(eq(verification.id, v.id));
  await db.update(recoverySecrets).set({ emailVerificadoAt: new Date() }).where(eq(recoverySecrets.userId, u.id));
  await auditar({ actorUserId: u.id, action: "usuario.email_recuperacion_verificado", entityType: "usuario", entityId: u.id });
  return { ok: true };
}

// ── 2FA TOTP ──────────────────────────────────────────────────────────────────

export async function iniciar2fa(password: string) {
  try {
    const res = await auth.api.enableTwoFactor({ body: { password, method: "totp" }, headers: await headers() });
    if (res.method !== "totp") throw new Error("se esperaba TOTP");
    const { totpURI, backupCodes } = res;
    const secreto = new URL(totpURI).searchParams.get("secret") ?? "";
    return { qr: await QRCode.toDataURL(totpURI, { margin: 1, width: 220 }), secreto, backupCodes };
  } catch {
    return { error: "La contraseña no es correcta." };
  }
}

export async function confirmar2fa(u: Usuario, code: string) {
  try {
    await auth.api.verifyTOTP({ body: { code: code.replace(/\s/g, "") }, headers: await headers() });
  } catch {
    return { error: "Código incorrecto. Revisá la hora del celular y probá con el código nuevo." };
  }
  await auditar({ actorUserId: u.id, action: "usuario.2fa_activado", entityType: "usuario", entityId: u.id });
  await finalizarSiCorresponde({ ...u, twoFactorEnabled: true });
  return { ok: true };
}
