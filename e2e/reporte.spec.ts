import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, ponerEnProgreso, pestana, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/05 RF-AGE-05 y spec/06 §3.6: jornadas en la agenda y Reporte Mensual precargado.
test("jornadas y reporte mensual", async ({ page }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);
  await ponerEnProgreso(page);
  const id = page.url().split("/").at(-1)!;

  // Jornada para mañana → aparece en la agenda.
  const manana = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(Date.now() + 86_400_000));
  await pestana(page, "Obra");
  const jornadas = page.locator("section").filter({ has: page.getByRole("heading", { name: "Jornadas de trabajo" }) });
  await jornadas.getByText("Nueva jornada").click();
  await jornadas.getByLabel("Fecha").fill(manana);
  await jornadas.getByLabel("Notas").fill("Pisos 10 al 6");
  await jornadas.getByLabel("Administrador").check();
  await jornadas.getByRole("button", { name: "Planificar" }).click();
  await expect(jornadas.getByText("Administrador · Pisos 10 al 6")).toBeVisible();
  await page.goto(`/agenda?semana=${manana}`);
  await expect(page.getByText(/Jornada de trabajo · \d{4}\/0001 · Constructora Ejemplo/)).toBeVisible();

  // El mes anterior: registros en 2 días distintos y una jornada en un tercero, todos del mismo operario.
  const ahora = new Date();
  const anterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 10));
  const mes = anterior.toISOString().slice(0, 7);
  const [{ uid }] = await sql`select id as uid from "user" limit 1`;
  for (const dia of ["03", "04"]) {
    const [r] = await sql`insert into registros_campo (presupuesto_id, fecha, piso, elemento, diametro_mm, cantidad, created_by) values (${id}, ${`${mes}-${dia}`}, '5', 'Viga', 152, 1, ${uid}) returning id`;
    await sql`insert into registro_operarios (registro_id, user_id) values (${r.id}, ${uid})`;
  }
  const [j] = await sql`insert into jornadas (presupuesto_id, fecha) values (${id}, ${`${mes}-05`}) returning id`;
  await sql`insert into jornada_operarios (jornada_id, user_id) values (${j.id}, ${uid})`;

  await page.goto(`/presupuestos/${id}?tab=obra`);
  await page.getByRole("link", { name: "Reportes mensuales" }).click();
  await expect(page.getByLabel("Mes a reportar")).toHaveValue(mes);
  await page.getByRole("button", { name: "Preparar reporte" }).click();
  await expect(page.getByLabel("Cantidad de trabajadores")).toHaveValue("1");
  await expect(page.getByLabel("Días trabajados")).toHaveValue("3");
  await expect(page.getByRole("article").getByText("Sin accidentes ni incidentes durante el período reportado.")).toBeVisible();

  await page.getByRole("button", { name: "Emitir reporte" }).click();
  const bajada = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click({ timeout: 60_000 });
  expect((await bajada).suggestedFilename()).toMatch(new RegExp(`^PAS - Reporte mensual Av\\. Córdoba 1234, CABA · ${mes} - Constructora Ejemplo\\.pdf$`));
});
