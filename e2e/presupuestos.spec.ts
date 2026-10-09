import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

const anio = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));

// spec/05 §7.
test("presupuesto: numeración, ítems, emisión, estados, revisión y visita", async ({ page }) => {
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);

  // Numeración: el año arranca en 105.
  await page.goto("/ajustes/presupuestos");
  const fila = page.getByRole("listitem").filter({ hasText: String(anio) }).first();
  await fila.getByLabel("Próximo número").fill("105");
  await fila.getByRole("button", { name: "Guardar" }).click();
  await expect(fila.getByText("Guardado.")).toBeVisible();

  // Cliente + obra.
  await page.goto("/explorador/nuevo");
  await page.getByLabel("Razón social").fill("Constructora Ejemplo");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await page.getByRole("link", { name: "Nueva obra" }).click();
  await page.getByLabel("Dirección").fill("Av. Córdoba 1234, CABA");
  await page.getByRole("button", { name: "Crear obra" }).click();

  // Prospecto con cliente: se numera al crearse.
  await page.getByRole("link", { name: "Presupuesto" }).click();
  await page.getByRole("button", { name: "Crear prospecto" }).click();
  const codigo = `${anio}/0105`;
  await expect(page.getByRole("heading", { name: codigo, exact: true })).toBeVisible();

  // No se puede fijar un número ya usado (el navegador lo frena con el mínimo del campo).
  await page.goto("/ajustes/presupuestos");
  await expect(fila.getByText(`Último usado: ${anio}/0105`)).toBeVisible();
  const proximo = fila.getByLabel("Próximo número");
  await proximo.fill("100");
  expect(await proximo.evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);

  // Prospecto anónimo: no consume número.
  await page.goto("/presupuestos/nuevo");
  await page.getByLabel("Todavía no sabemos").check();
  await page.getByLabel("Nombre del contacto").fill("Arq. Lucía");
  await page.getByLabel("Teléfono").fill("11 5555-0000");
  await page.getByLabel("Requiere visita técnica").check();
  await page.getByRole("button", { name: "Crear prospecto" }).click();
  await expect(page.getByRole("heading", { name: "Sin numerar", exact: true })).toBeVisible();
  const [{ n }] = await sql`select count(*)::int as n from presupuestos where numero is not null`;
  expect(n).toBe(1);

  // Visita del anónimo: aparece en la agenda.
  const manana = new Date(Date.now() + 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(manana);
  await page.getByRole("button", { name: "Agendar visita técnica" }).click();
  await page.getByLabel("Fecha y hora").fill(`${ymd}T10:30`);
  await page.getByLabel("Dirección").fill("Gurruchaga 980");
  await page.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(page.getByText("Agendada", { exact: true })).toBeVisible(); // exacto: "todavía no está agendada" también coincide
  await page.goto(`/agenda?semana=${ymd}`); // mañana puede caer en la semana siguiente
  await expect(page.getByText(/Visita técnica · sin numerar · Arq\. Lucía/)).toBeVisible();

  // Ítems del primero: 9 × $168.000 = $1.512.000 (template).
  await page.goto("/presupuestos?vista=lista");
  await page.getByRole("link", { name: new RegExp(codigo) }).click();
  await page.getByLabel("Ø (mm)").fill("152");
  await page.getByLabel("Espesor (cm)").fill("29");
  await page.getByLabel("Cantidad").fill("9");
  await page.getByLabel("Valor unidad").fill("168000");
  await expect(page.getByLabel(/^Descripción/)).toHaveValue("Perforaciones en viga, 152mm x 29cm de espesor");
  await expect(page.getByText("$ 1.512.000,00").first()).toBeVisible();
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  // Sin emitir no pasa a En espera.
  await page.getByLabel("Pasar a").selectOption({ label: "En espera" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText(/Emití el presupuesto antes/)).toBeVisible();

  // Emitir → En espera → En progreso (con fecha de confirmación).
  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await expect(page.getByText(`Emitido ${codigo}.`)).toBeVisible({ timeout: 30_000 }); // genera DOCX + PDF
  await page.getByLabel("Pasar a").selectOption({ label: "En espera" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText("En espera").first()).toBeVisible();
  await page.getByLabel("Pasar a").selectOption({ label: "En progreso" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByRole("heading", { name: codigo, exact: true }).locator("..").getByText("En progreso")).toBeVisible();

  // Nueva revisión R1 en borrador con los mismos ítems.
  await page.getByRole("button", { name: "Nueva revisión" }).click();
  await expect(page.getByText(`${codigo} R1`).first()).toBeVisible();
  await expect(page.getByLabel("Cantidad")).toHaveValue("9");

  // Buscador por número.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Buscar" }).fill("105");
  await expect(page.getByRole("group", { name: "Presupuestos" }).getByRole("option", { name: new RegExp(codigo) })).toBeVisible();

  const estados = (await sql`select hasta from estado_historial h join presupuestos p on p.id = h.presupuesto_id where p.numero = 105 order by h.at`).map((r) => r.hasta);
  expect(estados).toEqual(["prospecto", "en_espera", "en_progreso"]);
});
