import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/03 §4-§5: alta de usuario con clave temporal, roles, último admin y permisos por módulo.
test("admin gestiona usuarios y roles; operario sin acceso a ajustes", async ({ page }) => {
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);

  // Rol nuevo con un permiso.
  await page.getByRole("link", { name: "Ajustes" }).first().click();
  await page.getByRole("link", { name: /Roles y permisos/ }).click();
  await page.getByRole("link", { name: "Nuevo rol" }).click();
  await page.getByLabel("Nombre").fill("Supervisor");
  await page.getByRole("checkbox", { name: "Leer" }).first().check();
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page.getByRole("link", { name: /Supervisor/ })).toBeVisible();

  // Alta de operario: muestra la clave temporal una vez.
  await page.goto("/ajustes/usuarios/nuevo");
  await page.getByLabel("Nombre y apellido").fill("Juan Pérez");
  await page.getByLabel("Usuario").fill("jperez");
  await page.getByRole("checkbox", { name: "Operario" }).check();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Contraseña temporal")).toBeVisible();
  const temporal = (await page.locator("code").textContent())!.trim();

  // El admin no puede desactivarse a sí mismo.
  await page.goto("/ajustes/usuarios");
  await page.getByRole("main").getByRole("link", { name: /Administrador/ }).click();
  await page.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("No podés desactivar tu propio usuario.")).toBeVisible();

  // El operario entra con la temporal y la cambia; no tiene acceso a ajustes de usuarios.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Usuario o email").fill("jperez");
  await page.getByLabel("Contraseña").fill(temporal);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  await page.getByLabel("Contraseña actual").fill(temporal);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("clave-del-operario-1");
  await page.getByLabel("Repetir nueva contraseña").fill("clave-del-operario-1");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^(Buen día|Buenas tardes|Buenas noches), / })).toBeVisible();
  await page.goto("/ajustes/usuarios");
  await expect(page.getByRole("heading", { name: "No tenés permiso" })).toBeVisible();

  const [u] = await sql`select email from "user" where username = 'jperez'`;
  expect(u.email).toBe("jperez@sin-email.invalid");
  const acciones = (await sql`select action from audit_log`).map((r) => r.action);
  expect(acciones).toEqual(expect.arrayContaining(["rol.crear", "usuario.crear", "usuario.password_cambiada"]));
});
