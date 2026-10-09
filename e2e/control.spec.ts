import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/06 §3.5: control de perforaciones -CP1 desde los registros de campo, con IA-5 y emisión.
test("control de perforaciones: período, IA, emisión y descarga", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page); // 9 × Ø152
  await ponerEnProgreso(page);
  const id = page.url().split("/").at(-1)!;

  // Registros cargados en dos días: el 1/9 (pisos 17 y 16) y el 2/9 (piso 15).
  const [{ uid }] = await sql`select id as uid from "user" limit 1`;
  for (const [fecha, piso, cantidad, obs] of [
    ["2026-09-01", "17", 4, null],
    ["2026-09-01", "16", 3, "interferencia con armadura"],
    ["2026-09-02", "15", 2, null],
  ] as const) {
    const [r] = await sql`insert into registros_campo (presupuesto_id, fecha, piso, elemento, espesor_cm, diametro_mm, cantidad, observacion, created_by)
      values (${id}, ${fecha}, ${piso}, 'Viga', 29, 152, ${cantidad}, ${obs}, ${uid}) returning id`;
    await sql`insert into registro_operarios (registro_id, user_id) values (${r.id}, ${uid})`;
  }

  await page.goto(`/presupuestos/${id}/campo`);
  await page.getByRole("button", { name: "Control de perforaciones" }).click();
  await expect(page.getByRole("heading", { name: /^\d{4}\/0001-CP1$/ })).toBeVisible();
  const hoja = page.getByRole("article");
  await expect(hoja.getByText("Registro Detallado por Piso (Pisos 17 al 15)")).toBeVisible();
  await expect(hoja.getByRole("cell", { name: "Finalizado (interferencia con armadura)" })).toBeVisible();
  await expect(hoja.getByRole("cell", { name: "Completo" })).toBeVisible(); // 9 de 9

  // Solo el 1/9: 7 ejecutadas → faltan 2.
  await page.getByLabel("Hasta").fill("2026-09-01");
  await page.getByRole("button", { name: "Aplicar período" }).click();
  await expect(hoja.getByRole("cell", { name: "-2 unidades (Pendientes de realizar)" })).toBeVisible();
  await expect(hoja.getByText("Total Ejecutado (Pisos 17 al 16)")).toBeVisible();

  // IA-5: redactar las observaciones desde el balance.
  const obs = page.getByLabel("Observaciones", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await obs.getByRole("button", { name: "Asistente de IA" }).click();
  await obs.getByRole("button", { name: "Redactar desde los datos (pedido, visita o balance)" }).click();
  await obs.getByRole("button", { name: "Aceptar" }).click();
  await expect(page.getByLabel("Observaciones", { exact: true })).toHaveValue(/Se ejecutaron todas las perforaciones/);
  await expect(page.getByRole("button", { name: "Guardar versión" })).toBeDisabled(); // aceptar guarda una versión "IA"

  await page.getByRole("button", { name: "Emitir control" }).click();
  await expect(page.getByText(/^Emitido el \d/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Emitir control" })).toHaveCount(0);
  const bajada = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  expect((await bajada).suggestedFilename()).toMatch(/^PAS - Control de perforaciones \d{4}-0001-CP1 - Constructora Ejemplo\.pdf$/);

  const [doc] = await sql`select snapshot from documentos where tipo = 'control'`;
  expect(doc.snapshot.registros).toHaveLength(2);
  expect(doc.snapshot.total_diferencia).toBe("-2 unidades en total general");
});
