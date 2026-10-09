import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/05 §4: adicional sobre un presupuesto en curso, con su documento y su flujo de estados.
test("trabajo adicional: ítems, emisión con documento y aprobación", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);

  // Sin estar en curso no se ofrecen adicionales.
  await expect(page.getByRole("heading", { name: "Trabajos adicionales" })).toHaveCount(0);

  // Emitir → En espera → En progreso.
  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await expect(page.getByText(/^Emitido \d{4}\/0001\.$/)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Pasar a").selectOption({ label: "En espera" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByLabel("Pasar a").locator("option", { hasText: "En progreso" })).toHaveCount(1);
  await page.getByLabel("Pasar a").selectOption({ label: "En progreso" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();

  // Nuevo adicional AD1.
  await page.getByRole("button", { name: "Adicional" }).click();
  await expect(page.getByRole("heading", { name: /^\d{4}\/0001-AD1$/ })).toBeVisible();
  await page.getByLabel("Ø (mm)").fill("102");
  await page.getByLabel("Cantidad").fill("8");
  await page.getByLabel("Valor unidad").fill("128750");
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  // Documento con los textos del Word de adicionales.
  await page.getByRole("link", { name: "Editar textos del documento" }).click();
  const previa = page.getByRole("article", { name: "Vista previa del documento" });
  await expect(previa.getByRole("heading", { name: "COTIZACIÓN DE TRABAJOS ADICIONALES" })).toBeVisible();
  await expect(previa.getByText(/complementarios al presupuesto Nro\. \d{4}\/0001 con fecha/)).toBeVisible();
  await expect(previa.getByText("$ 1.030.000,00").first()).toBeVisible();
  await page.goBack();

  // Emitir y descargar.
  await page.getByRole("button", { name: "Emitir adicional" }).click();
  await expect(page.getByText(/^Emitido \d{4}\/0001-AD1\.$/)).toBeVisible({ timeout: 30_000 });
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^PAS - Adicional \d{4}-0001-AD1 - Constructora Ejemplo\.pdf$/);

  // Enviado → Aprobado.
  await page.getByLabel("Estado del adicional").selectOption({ label: "Aprobado por el cliente" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();

  const [a] = await sql`select estado, totales->>'neto' as neto from adicionales`;
  expect(a).toEqual({ estado: "aprobado", neto: "1030000" });
  const [d] = await sql`select tipo, estado, pdf_estado from documentos where tipo = 'adicional'`;
  expect(d).toEqual({ tipo: "adicional", estado: "emitido", pdf_estado: "ok" });

  // En el presupuesto aparece el adicional aprobado con su total.
  await page.getByRole("link", { name: /^\d{4}\/0001$/ }).click();
  await expect(page.getByRole("link", { name: /AD1.*Aprobado.*1\.030\.000,00/ })).toBeVisible();
});
