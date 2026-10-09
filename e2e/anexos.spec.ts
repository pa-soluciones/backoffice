import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/06 §7: anexos del presupuesto. Suben directo a R2 y se verifica el contenido real.
test("anexos: subir foto y PDF, rechazar archivo disfrazado y eliminar", async ({ page }) => {
  test.setTimeout(90_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);

  await expect(page.getByText("Sin archivos adjuntos.")).toBeVisible();
  await page.getByLabel("Categoría").selectOption("Plano");
  await page.getByLabel("Elegir archivos para adjuntar").setInputFiles([
    { name: "logo.png", mimeType: "image/png", buffer: readFileSync("public/email/logo-alt.png") },
    { name: "orden.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") },
    { name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("hola, no soy un PDF") },
  ]);
  await expect(page.getByText("falso.pdf: El contenido del archivo no corresponde a su tipo. No se guardó.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Abrir orden.pdf" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Abrir logo\.(png|webp)$/ })).toBeVisible();
  await expect(page.getByText(/^Plano · /).first()).toBeVisible();

  const bajada = page.waitForEvent("download");
  await page.getByRole("button", { name: "Abrir orden.pdf" }).click();
  expect((await bajada).suggestedFilename()).toBe("orden.pdf");

  await page.getByRole("button", { name: "Eliminar orden.pdf" }).click();
  await expect(page.getByRole("button", { name: "Abrir orden.pdf" })).toHaveCount(0);

  const acciones = await sql`select action from audit_log where action like 'anexo.%' order by id`;
  expect(acciones.map((a) => a.action)).toEqual(["anexo.subir", "anexo.subir", "anexo.eliminar"]);
  const [{ n }] = await sql`select count(*)::int n from archivos where entidad_tipo = 'presupuesto' and estado = 'ok' and deleted_at is null`;
  expect(n).toBe(1);
});
