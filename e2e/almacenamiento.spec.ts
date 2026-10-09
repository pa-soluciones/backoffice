import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// Guarda del free tier de R2: al llegar al límite se bloquea y solo un admin amplía, aceptando cargos.
test("almacenamiento: límite alcanzado y aprobación del admin", async ({ page }) => {
  await resetearBase();
  await primerInicioAdmin(page, ADMIN);
  const mes = new Date().toISOString().slice(0, 7);
  await sql`insert into r2_uso_mensual (mes, ops_a) values (${mes}, 800000)`;

  await page.goto("/ajustes");
  await page.getByRole("link", { name: /Almacenamiento/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "la carga y descarga de archivos está bloqueada" })).toBeVisible();
  await expect(page.getByText("800.000 de 800.000")).toBeVisible();
  await expect(page.getByText("Costo máximo posible: USD 0,00 en el mes.")).toBeVisible();

  // Sin aceptar los cargos, el navegador no deja enviar.
  await page.getByLabel(/Hasta el doble/).check();
  await page.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Límites ampliados para este mes.")).toHaveCount(0);

  await page.getByLabel(/Entiendo que lo que supere/).check();
  await page.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Límites ampliados para este mes.")).toBeVisible();
  await expect(page.getByText("800.000 de 2.000.000")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "bloqueada" })).toHaveCount(0);

  const [a] = await sql`select action, diff from audit_log where action = 'r2.excedente_aprobado'`;
  expect(a.diff.aprobado.opsA).toBe(2_000_000);
});
