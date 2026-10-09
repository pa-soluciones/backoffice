import { createHash, createHmac } from "node:crypto";
import postgres from "postgres";
import { TEST_DB } from "../playwright.config";

export const sql = postgres(TEST_DB, { onnotice: () => {} });

/** Deja la base de test sin usuarios ni límites (el admin se recrea al abrir /login). */
export async function resetearBase() {
  await sql`truncate "user", roles, rate_limit, verification cascade`;
}

/** Fija el código de verificación de email pendiente a uno conocido. */
export async function fijarCodigoEmail(codigo: string) {
  const hash = createHash("sha256").update(codigo).digest("hex");
  await sql`update verification set value = ${JSON.stringify({ hash, intentos: 0 })}
            where identifier like 'email-recuperacion:%'`;
}

/** TOTP RFC 6238 (SHA1, 30 s, 6 dígitos) a partir de la clave base32. */
export function totp(secretoBase32: string, ahora = Date.now()) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretoBase32.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const clave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30_000)));
  const h = createHmac("sha1", clave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Completa el asistente del admin por la UI y deja la sesión iniciada. Devuelve clave y secreto TOTP. */
export async function primerInicioAdmin(page: import("@playwright/test").Page, admin: { email: string; password: string }) {
  const { expect } = await import("@playwright/test");
  const nueva = "una-clave-nueva-larga-2026";
  const frase = "corona naranja perfora losa los martes";
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(admin.email);
  await page.getByLabel("Contraseña").fill(admin.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByLabel("Contraseña actual").fill(admin.password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
  await page.getByLabel("Repetir nueva contraseña").fill(nueva);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Frase de recuperación").fill(frase);
  await page.getByLabel("Repetir frase").fill(frase);
  await page.getByLabel("Correo de recuperación").fill("recuperacion@pas.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByRole("heading", { name: "Verificá tu correo" })).toBeVisible();
  await fijarCodigoEmail("123456");
  await page.getByLabel("Código").fill("123456");
  await page.getByRole("button", { name: "Verificar" }).click();
  await page.getByLabel("Confirmá tu contraseña").fill(nueva);
  await page.getByRole("button", { name: "Generar código QR" }).click();
  const secreto = (await page.locator("code").textContent())!.trim();
  await page.getByLabel("Código de la app").fill(totp(secreto));
  await page.getByRole("button", { name: "Activar y terminar" }).click();
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  return { password: nueva, secreto };
}
