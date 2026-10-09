import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/08 §2 y RF-STK-04: gasto y consumo cargados desde la obra sin conexión; gasto en dólares desde el presupuesto.
test("gastos: carga offline desde Campo, consumo de material y gasto en USD", async ({ page, context }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);
  await ponerEnProgreso(page);
  const id = page.url().split("/").at(-1)!;

  // 4 discos en la obra.
  const [a] = await sql`insert into articulos (nombre, categoria, unidad, costo_promedio_ars) values ('Disco 350', 'Disco', 'u', 5000) returning id`;
  await sql`insert into stock_movimientos (articulo_id, tipo, cantidad, desde, hacia, costo_unitario_ars, fecha) values
    (${a.id}, 'compra', 4, 'proveedor', 'deposito', 5000, '2026-09-01'), (${a.id}, 'asignacion', 4, 'deposito', ${id}, 5000, '2026-09-01')`;

  await page.goto(`/campo/${id}`);
  await expect(page.getByText("Todo sincronizado")).toBeVisible();
  await context.setOffline(true);

  await page.locator("summary", { hasText: "Cargar gasto" }).click();
  await page.getByLabel("Categoría").selectOption({ label: "Combustible" });
  await page.getByLabel("Descripción").fill("Nafta camioneta");
  await page.getByLabel("Importe").fill("45000");
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByText("Gasto guardado: se envía cuando vuelva la conexión.")).toBeVisible();

  await page.locator("summary", { hasText: "Consumo de material" }).click();
  await page.getByLabel("Cantidad consumida").fill("1");
  await page.getByRole("button", { name: "Guardar consumo" }).click();
  await expect(page.getByText("Consumo guardado (Disco 350 × 1).")).toBeVisible();
  await expect(page.getByText("Sin conexión · 2 pendientes")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Todo sincronizado")).toBeVisible({ timeout: 20_000 });

  // En el presupuesto: el gasto, el consumo y un gasto en dólares.
  await page.goto(`/presupuestos/${id}`);
  const gastos = page.locator("section").filter({ has: page.getByRole("heading", { name: "Gastos" }) });
  await expect(gastos.getByText("Nafta camioneta")).toBeVisible();
  await expect(page.getByRole("list", { name: "Materiales en obra" })).toContainText("3 u");

  await gastos.getByLabel("Categoría").selectOption({ label: "Alquiler de equipos" });
  await gastos.getByLabel("Descripción").fill("Alquiler de grupo electrógeno");
  await gastos.getByLabel("Importe").fill("150");
  await gastos.getByLabel("Moneda").selectOption("USD");
  await gastos.getByLabel("Tipo de cambio (pesos por dólar)").fill("1200");
  await gastos.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(gastos.getByText("Alquiler de grupo electrógeno")).toBeVisible();
  await expect(gastos.getByText("US$ 150,00")).toBeVisible();

  const filas = await sql`select descripcion, client_id is not null as offline from gastos order by created_at`;
  expect(filas).toEqual([
    { descripcion: "Nafta camioneta", offline: true },
    { descripcion: "Alquiler de grupo electrógeno", offline: false },
  ]);
});
