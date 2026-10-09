import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/10: la IA propone, el usuario acepta; se registra el costo y se marcan cifras nuevas.
test("asistente de IA: propuesta, aviso de cifras, aceptar y consumo", async ({ page }) => {
  await resetearBase();
  await sql`truncate ia_uso, configuracion`;
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);
  await page.getByRole("link", { name: "Editar textos del documento" }).click();
  await expect(page.getByRole("article")).toBeVisible();
  const urlDocumento = page.url();

  const garantia = page.getByLabel("Garantía", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await garantia.getByRole("button", { name: "Asistente de IA" }).click();
  await garantia.getByRole("button", { name: "Mejorar redacción" }).click();
  await expect(garantia.getByText("Propuesta de la IA")).toBeVisible();
  // "12" no estaba en el texto ni en los datos: se avisa.
  await expect(garantia.getByText(/La IA agregó cifras que no estaban: 12/)).toBeVisible();
  await garantia.getByRole("button", { name: "Aceptar" }).click();
  await expect(page.getByLabel("Garantía", { exact: true })).toHaveValue(/12 meses/);
  await expect(page.getByText("Todo guardado")).toBeVisible();
  await expect(page.getByRole("article").getByText("12 meses")).toBeVisible();

  const [v] = await sql`select origen from documento_versiones order by nro desc limit 1`;
  expect(v.origen).toBe("ia");
  const [u] = await sql`select modelo, tokens_entrada, costo_usd from ia_uso`;
  expect(u).toMatchObject({ modelo: "claude-opus-5-5", tokens_entrada: 1200 });
  expect(Number(u.costo_usd)).toBeCloseTo((1200 * 4 + 60 * 20) / 1e6, 6);

  // Consumo en Ajustes; con tope 0 la IA se bloquea.
  await page.goto("/ajustes/ia");
  await expect(page.getByText("Claude está conectado")).toBeVisible();
  await expect(page.getByText(/1 pedido/)).toBeVisible();
  await page.getByLabel("Tope mensual (USD)").fill("0");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.goto(urlDocumento);
  const g2 = page.getByLabel("Garantía", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await g2.getByRole("button", { name: "Asistente de IA" }).click();
  await g2.getByRole("button", { name: "Más corto" }).click();
  await expect(g2.getByText(/Se alcanzó el tope mensual de IA/)).toBeVisible();
});
