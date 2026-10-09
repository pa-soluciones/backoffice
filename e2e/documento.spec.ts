import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/06 §8: editar textos con versiones, emitir y descargar DOCX/PDF.
test("documento del presupuesto: editar, versiones, emitir y descargar", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);

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

  // Editor: textos por defecto del Word y vista previa en vivo.
  await page.getByRole("link", { name: "Editar textos del documento" }).click();
  const previa = page.getByRole("article", { name: "Vista previa del documento" });
  await expect(previa.getByText("Estimados Sres. Constructora Ejemplo, en respuesta")).toBeVisible();
  await expect(previa.getByText("9 perforaciones de Ø 152 mm sobre viga de 29 cm de espesor", { exact: false })).toBeVisible();
  await expect(previa.getByText("$ 1.512.000,00").first()).toBeVisible();

  const garantia = page.getByLabel("Garantía", { exact: true });
  await garantia.fill("Garantía de **12 meses** sobre la mano de obra.");
  await expect(previa.getByText("12 meses")).toBeVisible();
  await page.getByRole("button", { name: "Guardar versión" }).click();
  await expect(page.getByText("Todo guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Garantía", { exact: true })).toHaveValue("Garantía de **12 meses** sobre la mano de obra.");

  // Restaurar la versión inicial.
  await page.getByText(/Versiones \(2\)/).click();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByLabel("Garantía", { exact: true })).toHaveValue("Garantía de mano de obra hasta la finalización de los trabajos.");

  // Volver a poner el texto propio y emitir.
  await page.getByLabel("Garantía", { exact: true }).fill("Garantía de **12 meses** sobre la mano de obra.");
  await page.getByRole("button", { name: "Guardar versión" }).click();
  await expect(page.getByText("Todo guardado")).toBeVisible();
  await page.getByRole("link", { name: /^\d{4}\/\d{4}$/ }).click();
  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await expect(page.getByText(/^Emitido \d{4}\/0001\.$/)).toBeVisible({ timeout: 30_000 });

  // Descargas: PDF y Word salen de R2 (mock) con el nombre del documento.
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^PAS - Presupuesto \d{4}-0001 - Constructora Ejemplo\.pdf$/);
  const [word] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Word" }).click()]);
  expect(word.suggestedFilename()).toMatch(/\.docx$/);

  const [doc] = await sql`select estado, pdf_estado, snapshot->'garantia' as garantia from documentos`;
  expect(doc.estado).toBe("emitido");
  expect(doc.pdf_estado).toBe("ok");
  expect(JSON.stringify(doc.garantia)).toContain("12 meses");
  const [{ n }] = await sql`select count(*)::int as n from archivos where estado = 'ok'`;
  expect(n).toBe(2);
  const [uso] = await sql`select ops_a, ops_b from r2_uso_mensual`;
  expect(Number(uso.ops_a)).toBe(2);

  // Emitido: el editor queda en solo lectura.
  await page.getByRole("link", { name: "Ver documento" }).click();
  await expect(page.getByText(/ya está emitido: solo lectura/)).toBeVisible();
});
