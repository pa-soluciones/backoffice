import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, pestana, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/08 §4: resumen económico proyectado → congelado al terminar, y finanzas de la empresa.
test("resumen económico y finanzas", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page); // $1.512.000
  await ponerEnProgreso(page);
  const id = page.url().split("/").at(-1)!;
  const hoy = new Date().toISOString().slice(0, 10);

  // Egresos: $12.000 de combustible y 3 coronas consumidas a $150.
  const [{ uid }] = await sql`select id as uid from "user" limit 1`;
  const [cat] = await sql`select id from categorias_gasto where nombre = 'Combustible'`;
  await sql`insert into gastos (fecha, presupuesto_id, categoria_id, descripcion, importe, moneda, created_by) values (${hoy}, ${id}, ${cat.id}, 'Nafta', 12000, 'ARS', ${uid})`;
  const [a] = await sql`insert into articulos (nombre, categoria, costo_promedio_ars) values ('Corona', 'Corona diamantada', 150) returning id`;
  await sql`insert into stock_movimientos (articulo_id, tipo, cantidad, desde, hacia, costo_unitario_ars, fecha) values
    (${a.id}, 'asignacion', 3, 'deposito', ${id}, 150, ${hoy}), (${a.id}, 'consumo', 3, ${id}, 'consumido', 150, ${hoy})`;

  await page.reload();
  await pestana(page, "Cobros y gastos");
  const resumen = page.locator("section").filter({ has: page.getByRole("heading", { name: "Resumen económico" }) });
  await expect(resumen).toContainText("Total a cobrar$ 1.512.000,00");
  await expect(resumen).toContainText("Combustible$ 12.000,00");
  await expect(resumen).toContainText("Total egresos$ 12.450,00");
  await expect(resumen).toContainText("Resultado proyectado$ 1.499.550,00");
  await expect(resumen).toContainText("Margen 99,2%");

  // Se cobra todo → Terminado → resumen congelado.
  const cobros = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cobros" }) });
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobros.getByText("ABONADO")).toBeVisible();
  await page.getByLabel("Pasar a").selectOption({ label: "Pendiente liquidación" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(cobros.getByRole("listitem").filter({ hasText: /^Saldo del 60%/ })).toBeVisible();
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByText("Saldo cancelado: el presupuesto pasó a Terminado.")).toBeVisible();
  await expect(resumen).toContainText("Resultado final$ 1.499.550,00");
  const [p] = await sql`select resumen_final->>'resultado' as resultado from presupuestos`;
  expect(Number(p.resultado)).toBe(1_499_550);

  // Finanzas del mes.
  await page.goto("/finanzas");
  await expect(page.getByText("Cobrado (pesos)$ 1.512.000,00")).toBeVisible();
  await expect(page.getByText("Egresos (compras y gastos)$ 12.000,00")).toBeVisible();
  await expect(page.getByRole("link", { name: /\d{4}\/0001.*Terminado.*99,2%/ })).toBeVisible();

  await page.getByText("Nuevo gasto general").click();
  await page.getByLabel("Categoría").selectOption({ label: "Otros" });
  await page.getByLabel("Descripción").fill("Alquiler de oficina");
  await page.getByLabel("Importe").fill("50000");
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByText("Alquiler de oficina")).toBeVisible();
  await expect(page.getByText("Egresos (compras y gastos)$ 62.000,00")).toBeVisible();
});
