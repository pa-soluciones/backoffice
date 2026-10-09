import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/03 §3: admin recupera con link + frase; puede resetear su 2FA.
test("admin recupera contraseña y 2FA con link y frase", async ({ page }) => {
  await resetearBase();
  await primerInicioAdmin(page, ADMIN);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  // Pedido con un error de tipeo: misma respuesta, y se puede volver a pedir con otro dato.
  await page.goto("/recuperar");
  await page.getByLabel("Usuario o email").fill("admni");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/te enviamos un link/)).toBeVisible();
  await expect(page.getByText("admni")).toBeVisible();
  await page.getByRole("button", { name: "Probar con otro usuario o email" }).click();
  await expect(page.getByLabel("Usuario o email")).toHaveValue("");
  await page.getByLabel("Usuario o email").fill("admin");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText("admin", { exact: true })).toBeVisible();
  const [{ n }] = await sql`select count(*)::int as n from verification where identifier like 'reset:%'`;
  expect(n).toBe(1);

  // El token real viaja por email; en el test se crea uno conocido para el mismo usuario.
  const token = "token-de-prueba-recuperacion-0123456789";
  const [admin] = await sql`select id from "user" where username = 'admin'`;
  await sql`insert into verification (identifier, value, expires_at)
            values (${"reset:" + createHash("sha256").update(token).digest("hex")},
                    ${JSON.stringify({ userId: admin.id, intentos: 0 })}, now() + interval '30 minutes')`;

  await page.goto(`/recuperar/${token}`);
  await page.getByLabel("Frase de recuperación").fill("frase equivocada de prueba");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("clave-recuperada-2026");
  await page.getByLabel("Repetir nueva contraseña").fill("clave-recuperada-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText(/La frase no coincide. Te quedan 4 intentos/)).toBeVisible();

  await page.getByLabel("Frase de recuperación").fill("corona naranja perfora losa los martes");
  await page.getByLabel(/También perdí el acceso/).check();
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Listo, tu contraseña se actualizó.")).toBeVisible();

  // El link no se puede reusar.
  await page.goto(`/recuperar/${token}`);
  await expect(page.getByRole("heading", { name: "Link vencido" })).toBeVisible();

  // Entra con la nueva clave y, como su rol exige 2FA, lo configura de nuevo.
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill("admin");
  await page.getByLabel("Contraseña").fill("clave-recuperada-2026");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();

  const acciones = (await sql`select action from audit_log`).map((r) => r.action);
  expect(acciones).toEqual(
    expect.arrayContaining(["auth.recuperacion_solicitada", "auth.recuperacion_frase_incorrecta", "auth.recuperacion_password_y_2fa"]),
  );
});
