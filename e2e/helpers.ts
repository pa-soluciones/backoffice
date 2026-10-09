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
