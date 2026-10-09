import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, pestana, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/08 §3: anticipo al pasar a En progreso, saldo en Pendiente liquidación, cobro en otra moneda
// y paso automático a Terminado al cancelar el saldo (spec/05 criterio de aceptación).
test("cobros: anticipo, parcial, saldo en dólares y cierre automático", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page); // 9 × $168.000 = $1.512.000
  await ponerEnProgreso(page);
  await pestana(page, "Cobros y gastos");

  const cobros = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cobros" }) });
  await expect(cobros.getByRole("listitem").filter({ hasText: /^Anticipo del 40% sobre el presupuesto original/ })).toBeVisible();
  await expect(cobros.getByText("$ 604.800,00").first()).toBeVisible();

  // Pago parcial del anticipo.
  await cobros.getByLabel("Importe").fill("300000");
  await cobros.getByLabel("Referencia").fill("Transf. 123");
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobros.getByText("Cobro registrado.")).toBeVisible();
  await expect(cobros.getByText("PARCIAL")).toBeVisible();

  // Resto del anticipo (el importe propuesto es lo que falta).
  await expect(cobros.getByLabel("Importe")).toHaveValue("304800");
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobros.getByText("ABONADO")).toBeVisible();

  // Fin de obra: se genera el saldo del 60%.
  await page.getByLabel("Pasar a").selectOption({ label: "Pendiente liquidación" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(cobros.getByRole("listitem").filter({ hasText: /^Saldo del 60% sobre el presupuesto original/ })).toBeVisible();

  // El cliente paga el saldo en dólares: US$ 907,20 a $ 1.000 = $ 907.200.
  await cobros.getByLabel("Moneda recibida").selectOption("USD");
  await cobros.getByLabel("Importe").fill("907.20");
  await cobros.getByLabel("Tipo de cambio (pesos por dólar)").fill("1000");
  await cobros.getByLabel("Medio de pago").selectOption("efectivo");
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByText("Saldo cancelado: el presupuesto pasó a Terminado.")).toBeVisible();
  await expect(page.getByText("US$ 907,20 → $ 907.200,00 (TC 1000)")).toBeVisible();

  const [p] = await sql`select estado from presupuestos`;
  expect(p.estado).toBe("terminado");
  const acciones = await sql`select action from audit_log where action like 'cobro.%' order by id`;
  expect(acciones).toHaveLength(3);
});
