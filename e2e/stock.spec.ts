import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/08 §1 y criterios de aceptación: promedio ponderado, asignación, cierre obligatorio.
test("stock: compras con promedio, asignación a obra y cierre de materiales", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);

  // 10 coronas a $100 (artículo nuevo, sin proveedor ni comprobante) y 10 a $200.
  await page.goto("/stock/compra");
  await page.getByLabel("Artículo 1", { exact: true }).selectOption({ label: "Artículo nuevo…" });
  await page.getByLabel("Nombre del artículo nuevo").fill("Corona Ø102");
  await page.getByLabel("Cantidad").fill("10");
  await page.getByLabel("Precio unitario").fill("100");
  await page.getByRole("button", { name: "Registrar compra" }).click();
  await expect(page.getByText("Compra registrada.")).toBeVisible();
  await page.reload();
  await page.getByLabel("Artículo 1", { exact: true }).selectOption({ label: "Corona Ø102 (u)" });
  await page.getByLabel("Proveedor (opcional)").selectOption({ label: "Nuevo proveedor…" });
  await page.getByLabel("Nombre del proveedor").fill("Diamantados SA");
  await page.getByLabel("Cantidad").fill("10");
  await page.getByLabel("Precio unitario").fill("200");
  await page.getByRole("button", { name: "Registrar compra" }).click();
  await expect(page.getByText("Compra registrada.")).toBeVisible();

  await page.goto("/stock");
  const fila = page.getByRole("link", { name: /Corona Ø102/ });
  await expect(fila).toContainText("20 u");
  await expect(fila).toContainText("$ 150,00 c/u");

  // Obra en progreso: asignar 5.
  await crearPresupuestoConItem(page);
  await ponerEnProgreso(page);
  const materiales = page.locator("section").filter({ has: page.getByRole("heading", { name: "Materiales" }) });
  await materiales.getByRole("button", { name: "Asignar del depósito" }).click();
  await materiales.getByLabel("Artículo 1", { exact: true }).selectOption({ label: "Corona Ø102 (hay 20 u)" });
  await materiales.getByLabel("Cantidad").fill("5");
  await materiales.getByRole("button", { name: "Asignar", exact: true }).click();
  await expect(materiales.getByRole("list", { name: "Materiales en obra" })).toContainText("5 u");

  // Sin cierre no pasa a Pendiente liquidación.
  await page.getByLabel("Pasar a").selectOption({ label: "Pendiente liquidación" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText("Falta el cierre de materiales")).toBeVisible();

  // Cierre: consumido 3, vuelven 2.
  await materiales.getByRole("button", { name: "Cierre de materiales" }).click();
  await materiales.getByLabel("Consumido").fill("3");
  await materiales.getByLabel("Vuelve al depósito").fill("2");
  await materiales.getByLabel("Estado al volver").fill("Vida restante 50%");
  await materiales.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(materiales.getByText("No hay materiales en la obra.")).toBeVisible();

  await page.getByLabel("Pasar a").selectOption({ label: "Pendiente liquidación" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByLabel("Pasar a").locator("option", { hasText: "Pendiente liquidación" })).toHaveCount(0);

  // Depósito: 20 − 5 + 2 = 17; consumo valorizado 3 × $150.
  const [{ consumo }] = await sql`select sum(cantidad * costo_unitario_ars)::float as consumo from stock_movimientos where tipo = 'consumo'`;
  expect(consumo).toBe(450);
  await page.goto("/stock");
  await expect(page.getByRole("link", { name: /Corona Ø102/ })).toContainText("17 u");

  // No se puede dar de baja más de lo que hay.
  await page.getByRole("link", { name: /Corona Ø102/ }).click();
  await page.getByLabel("Baja (rotura, pérdida)").check();
  await page.getByLabel("Cantidad (u)").fill("100");
  await page.getByLabel("Motivo").fill("Rotura");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Corona Ø102: hay 17 u en el depósito.")).toBeVisible();
});
