import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/06 §3.3: certificación de obra con cantidades desde campo, tope en lo cotizado,
// situación de pagos desde cobros y saldo en letras.
test("certificación de obra: parcial desde lo ejecutado, final y emisión", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page); // 9 × Ø152 a $168.000
  await ponerEnProgreso(page);
  const id = page.url().split("/").at(-1)!;

  // Anticipo cobrado ($604.800) y 6 perforaciones ejecutadas.
  const cobros = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cobros" }) });
  await cobros.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobros.getByText("ABONADO")).toBeVisible();
  const [{ uid }] = await sql`select id as uid from "user" limit 1`;
  await sql`insert into registros_campo (presupuesto_id, item_id, fecha, piso, elemento, espesor_cm, diametro_mm, cantidad, created_by)
    select ${id}, i.id, '2026-09-01', '17', 'Viga', 29, 152, 6, ${uid} from items i join presupuesto_revisiones r on r.id = i.revision_id where r.presupuesto_id = ${id}`;

  await page.getByRole("button", { name: "Certificación de obra" }).click();
  await expect(page.getByRole("heading", { name: /^\d{4}\/0001-C1$/ })).toBeVisible();
  const hoja = page.getByRole("article");
  const cantidad = page.getByLabel(/^Cantidad a certificar/);
  await expect(cantidad).toHaveValue("6"); // lo ejecutado
  await expect(hoja.getByText("CERTIFICACIÓN DE OBRA (PARCIAL)")).toBeVisible();
  await expect(hoja.getByRole("cell", { name: "$ 1.008.000,00" }).first()).toBeVisible();
  await expect(hoja.getByText("PESOS CUATROCIENTOS TRES MIL DOSCIENTOS CON 00/100 ($ 403.200,00)", { exact: false })).toBeVisible();
  await expect(hoja.getByText("ha percibido de conformidad el anticipo del 40%")).toBeVisible();

  // No se certifica más de lo cotizado.
  await cantidad.fill("10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  expect(await cantidad.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true); // el servidor también lo valida

  // Final por lo cotizado: saldo $907.200.
  await page.getByLabel("Final").check();
  await cantidad.fill("9");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(hoja.getByText("CERTIFICACIÓN DE OBRA", { exact: true })).toBeVisible();
  await expect(hoja.getByText(/PESOS NOVECIENTOS SIETE MIL DOSCIENTOS CON 00\/100/)).toBeVisible();

  await page.getByRole("button", { name: "Emitir certificación" }).click();
  await expect(page.getByText(/^Final · Emitida el/)).toBeVisible({ timeout: 60_000 });
  const bajada = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  expect((await bajada).suggestedFilename()).toMatch(/^PAS - Certificación \d{4}-0001-C1 - Constructora Ejemplo\.pdf$/);

  await page.goto(`/presupuestos/${id}`);
  await expect(page.getByRole("link", { name: /-C1.*Final · Emitida.*1\.512\.000,00/ })).toBeVisible();
});
