import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { fijarCodigoEmail, resetearBase, sql, totp } from "./helpers";

// spec/03 §7: el admin no accede a nada hasta completar el asistente; después login exige 2FA.
test("primer inicio del admin y login con 2FA", async ({ page }) => {
  await resetearBase();
  const nueva = "una-clave-nueva-larga-2026";

  // Sin sesión, la app redirige al login.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  // El primer acceso a /login crea el admin inicial.
  await page.reload();
  await page.getByLabel("Usuario o email").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  // Paso 1: contraseña nueva. Bloquea el resto de la app mientras tanto.
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  await page.getByLabel("Contraseña actual").fill(ADMIN.password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Repetir nueva contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/distinta de la actual/)).toBeVisible();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
  await page.getByLabel("Repetir nueva contraseña").fill(nueva);
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 2: frase + correo de recuperación.
  await expect(page.getByRole("heading", { name: "Datos de recuperación" })).toBeVisible();
  const frase = "corona naranja perfora losa los martes";
  await page.getByLabel("Frase de recuperación").fill(frase);
  await page.getByLabel("Repetir frase").fill(frase);
  await page.getByLabel("Correo de recuperación").fill("recuperacoin@pas.test");
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Correo mal escrito: se puede volver a cargarlo.
  await expect(page.getByText("recuperacoin@pas.test")).toBeVisible();
  await page.getByRole("button", { name: /Cambiar correo/ }).click();
  await expect(page.getByRole("heading", { name: "Datos de recuperación" })).toBeVisible();
  await page.getByLabel("Frase de recuperación").fill(frase);
  await page.getByLabel("Repetir frase").fill(frase);
  await page.getByLabel("Correo de recuperación").fill("recuperacion@pas.test");
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Paso 3: código por email (en test se fija a uno conocido).
  await expect(page.getByRole("heading", { name: "Verificá tu correo" })).toBeVisible();
  await expect(page.getByText("recuperacion@pas.test")).toBeVisible();
  await fijarCodigoEmail("123456");
  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText(/Te quedan 4 intentos/)).toBeVisible();
  await page.getByLabel("Código").fill("123456");
  await page.getByRole("button", { name: "Verificar" }).click();

  // Paso 4: 2FA.
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
  await page.getByLabel("Confirmá tu contraseña").fill(nueva);
  await page.getByRole("button", { name: "Generar código QR" }).click();
  const secreto = (await page.locator("code").textContent())!.trim();
  await expect(page.getByRole("list", { name: "Códigos de respaldo" }).getByRole("listitem")).toHaveCount(10);
  await page.getByLabel("Código de la app").fill(totp(secreto));
  await page.getByRole("button", { name: "Activar y terminar" }).click();

  // Asistente completo → inicio.
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  const [u] = await sql`select must_complete_setup, must_change_password, two_factor_enabled from "user"`;
  expect(u).toEqual({ must_complete_setup: false, must_change_password: false, two_factor_enabled: true });

  // Logout y login de nuevo: ahora pide el código de la app.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Usuario o email").fill("admin");
  await page.getByLabel("Contraseña").fill(nueva);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/login\/2fa$/);
  await page.getByLabel("Código").fill(totp(secreto));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();

  // Auditoría registró los pasos.
  const acciones = (await sql`select action from audit_log order by id`).map((r) => r.action);
  expect(acciones).toEqual(
    expect.arrayContaining([
      "usuario.bootstrap_admin",
      "usuario.password_cambiada",
      "usuario.recuperacion_configurada",
      "usuario.email_recuperacion_verificado",
      "usuario.2fa_activado",
      "usuario.configuracion_inicial_completa",
    ]),
  );
});

test.afterAll(async () => {
  await sql.end();
});
