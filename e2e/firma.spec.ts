import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/06 §6: firma de la empresa para los documentos.
test("firma de la empresa: cargar, rechazar lo que no es PNG y quitar", async ({ page }) => {
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await page.goto("/ajustes/presupuestos");
  await expect(page.getByText("Sin firma cargada")).toBeVisible();

  await page.getByLabel("Cargar firma").setInputFiles({ name: "firma.png", mimeType: "image/png", buffer: Buffer.from("no soy un png") });
  await page.getByRole("button", { name: "Guardar firma" }).click();
  await expect(page.getByText("La firma tiene que ser una imagen PNG")).toBeVisible();

  await page.getByLabel("Cargar firma").setInputFiles({ name: "firma.png", mimeType: "image/png", buffer: readFileSync("public/email/logo-alt.png") });
  await page.getByRole("button", { name: "Guardar firma" }).click();
  await expect(page.getByRole("img", { name: "Firma actual" })).toBeVisible();
  const [c] = await sql`select valor from configuracion where clave = 'firma_empresa'`;
  expect(c.valor.ancho).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByText("Sin firma cargada")).toBeVisible();
  const acciones = await sql`select diff->>'accion' a from audit_log where action = 'configuracion.firma' order by id`;
  expect(acciones.map((x) => x.a)).toEqual(["cargar", "quitar"]);
});
