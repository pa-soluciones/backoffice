import { createHash, createHmac } from "node:crypto";
import postgres from "postgres";
import { TEST_DB } from "../playwright.config";

export const sql = postgres(TEST_DB, { onnotice: () => {} });

/** Deja la base de test sin usuarios ni límites (el admin se recrea al abrir /login). */
export async function resetearBase() {
  await sql`truncate "user", roles, rate_limit, verification, numeracion_anual, r2_uso_mensual, archivos, stock_movimientos, compras, articulos, proveedores, gastos cascade`;
  await sql`delete from configuracion where clave in ('firma_empresa', 'ia')`;
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
  await expect(page.getByRole("heading", { level: 1, name: /^(Buen día|Buenas tardes|Buenas noches), / })).toBeVisible();
  return { password: nueva, secreto };
}

/** Cliente + obra + presupuesto con un ítem (9 × Ø152 a $168.000). Queda en el detalle del presupuesto. */
export async function crearPresupuestoConItem(page: import("@playwright/test").Page) {
  const { expect } = await import("@playwright/test");
  await page.goto("/explorador/nuevo");
  await page.getByLabel("Razón social").fill("Constructora Ejemplo");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await page.getByRole("link", { name: "Nueva obra" }).click();
  await page.getByLabel("Dirección").fill("Av. Córdoba 1234, CABA");
  await page.getByRole("button", { name: "Crear obra" }).click();
  await page.getByRole("link", { name: "Presupuesto" }).click();
  await page.getByRole("button", { name: "Crear prospecto" }).click();
  await page.getByLabel("Ø (mm)").fill("152");
  await page.getByLabel("Espesor (cm)").fill("29");
  await page.getByLabel("Cantidad").fill("9");
  await page.getByLabel("Valor unidad").fill("168000");
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
}

/** Desde el detalle de un presupuesto en borrador: emitir → En espera → En progreso. */
export async function ponerEnProgreso(page: import("@playwright/test").Page) {
  const { expect } = await import("@playwright/test");
  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await expect(page.getByText(/^Emitido \d{4}\/\d{4}\.$/)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Pasar a").selectOption({ label: "En espera" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByLabel("Pasar a").locator("option", { hasText: "En progreso" })).toHaveCount(1);
  await page.getByLabel("Pasar a").selectOption({ label: "En progreso" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByLabel("Pasar a").locator("option", { hasText: "En progreso" })).toHaveCount(0);
}

/** Pestaña del detalle del presupuesto ("Presupuesto", "Obra", "Cobros y gastos", "Archivos", "Historial"). */
export async function pestana(page: import("@playwright/test").Page, nombre: "Presupuesto" | "Documentos" | "Obra" | "Cobros y gastos" | "Archivos" | "Historial") {
  await page.getByRole("navigation", { name: "Secciones del presupuesto" }).getByRole("link", { name: new RegExp(`^${nombre}`) }).click();
  const { expect } = await import("@playwright/test");
  await expect(page).toHaveURL(new RegExp(`tab=`));
}
