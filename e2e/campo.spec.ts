import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/07: registros de campo con fotos, carga sin conexión y balance contra lo cotizado (9 × Ø152).
test("campo: registrar con foto, en modo avión y ver el balance", async ({ page, context }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);
  await ponerEnProgreso(page);

  await page.goto("/campo");
  await page.getByRole("link", { name: /^\d{4}\/0001/ }).click();
  await page.getByLabel("Piso").fill("17");
  await page.getByLabel("Ø (mm)").fill("152");
  await page.getByLabel("Espesor (cm)").fill("29");
  await page.getByLabel("Cantidad").fill("6");
  await page.getByLabel("Agregar fotos").setInputFiles({ name: "viga.png", mimeType: "image/png", buffer: readFileSync("public/email/logo-alt.png") });
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Registro guardado (Piso 17, Ø152 × 6).")).toBeVisible();
  await expect(page.getByText("Todo sincronizado")).toBeVisible({ timeout: 20_000 });

  // Precarga para cargar en serie.
  await expect(page.getByLabel("Piso")).toHaveValue("17");
  await expect(page.getByLabel("Ø (mm)")).toHaveValue("152");

  // Modo avión: 2 registros quedan en cola y se envían al volver la conexión, sin duplicados.
  await context.setOffline(true);
  await expect(page.getByText(/^Sin conexión · 0 pendientes$/)).toBeVisible();
  for (const piso of ["16", "15"]) {
    await page.getByLabel("Piso").fill(piso);
    await page.getByLabel("Cantidad").fill("4");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText(`Registro guardado (Piso ${piso}, Ø152 × 4). Sin evidencia fotográfica. Se envía cuando vuelva la conexión.`)).toBeVisible();
  }
  await expect(page.getByText("Sin conexión · 2 pendientes")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Todo sincronizado")).toBeVisible({ timeout: 20_000 });
  const [{ n }] = await sql`select count(*)::int n from registros_campo`;
  expect(n).toBe(3);

  // Balance: 9 cotizadas, 14 ejecutadas → +5 en exceso; aviso para crear adicional.
  await page.getByRole("link", { name: "Ver registros, fotos y balance" }).click();
  await expect(page.getByRole("cell", { name: "+5 unidades (Ejecutadas en exceso)" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "5 perforaciones Ø152 sin cotizar" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Foto: Piso 17 · Viga · Ø152 × 6" })).toBeVisible();
  await expect(page.getByText("Sin evidencia fotográfica", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Piso 17" })).toBeVisible();

  // Editar y eliminar.
  await page.getByRole("button", { name: "Editar Piso 15 · Viga · Ø152 × 4" }).click();
  await page.getByLabel("Cantidad").fill("3");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Piso 15 · Viga · Ø152 × 3")).toBeVisible();
  await page.getByRole("button", { name: "Eliminar Piso 16 · Viga · Ø152 × 4" }).click();
  await expect(page.getByRole("cell", { name: "Completo" })).toBeVisible();

  const acciones = await sql`select action from audit_log where action like 'campo.%' order by id`;
  expect(acciones.map((a) => a.action)).toEqual(["campo.registrar", "campo.registrar", "campo.registrar", "campo.editar", "campo.eliminar"]);
});
