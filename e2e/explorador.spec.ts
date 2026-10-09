import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase } from "./helpers";

// spec/04 §7: clientes, obras, directores, duplicados y buscador.
test("explorador: cliente, obra con director nuevo, duplicados y buscador", async ({ page }) => {
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);

  // Cliente con CUIT inválido → error; válido → se crea.
  await page.getByRole("link", { name: "Explorador" }).first().click();
  await expect(page.getByText("Todavía no hay clientes")).toBeVisible();
  await page.getByRole("link", { name: "Nuevo cliente" }).click();
  await page.getByLabel("Razón social").fill("Constructora Ejemplo");
  await page.getByLabel("CUIT (opcional)").fill("20-12345678-5");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText(/El CUIT no es válido/)).toBeVisible();
  await page.getByLabel("CUIT (opcional)").fill("20123456786");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByRole("heading", { name: "Constructora Ejemplo" })).toBeVisible();
  await expect(page.getByText("CUIT 20-12345678-6")).toBeVisible();

  // Obra con director creado en el mismo formulario.
  await page.getByRole("link", { name: "Nueva obra" }).click();
  await page.getByLabel("Dirección").fill("Av. Córdoba 1234, CABA");
  await page.getByLabel("Director de obra").selectOption({ label: "+ Nuevo director…" });
  await page.getByLabel("Nombre del nuevo director").fill("Martín Gómez");
  await page.getByRole("button", { name: "Crear obra" }).click();
  await expect(page.getByRole("heading", { name: "Av. Córdoba 1234, CABA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Martín Gómez" })).toBeVisible();

  // Aviso de posible duplicado y rechazo de razón social repetida (sin importar acentos/mayúsculas).
  await page.goto("/explorador/nuevo");
  await page.getByLabel("Razón social").fill("CONSTRUCTORA EJEMPLO SRL");
  await expect(page.getByText("¿Ya existe? Hay clientes parecidos:")).toBeVisible();
  await page.getByLabel("Razón social").fill("constructora ejémplo");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText("Ya existe un cliente con esa razón social.")).toBeVisible();

  // Buscador: sin acentos, por director y con un error de tipeo.
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const buscador = page.getByRole("combobox", { name: "Buscar" });
  await buscador.fill("cordoba");
  await expect(page.getByRole("option", { name: /Av\. Córdoba 1234/ })).toBeVisible();
  await buscador.fill("gomez");
  await expect(page.getByRole("group", { name: "Directores de obra" }).getByRole("option", { name: /Martín Gómez/ })).toBeVisible();
  await expect(page.getByRole("group", { name: "Obras" }).getByRole("option", { name: /Córdoba/ })).toBeVisible();
  await buscador.fill("constructra ejemplo");
  await expect(page.getByRole("group", { name: "Clientes" }).getByRole("option", { name: /Constructora Ejemplo/ })).toBeVisible();
  await buscador.press("Enter");
  await expect(page.getByRole("heading", { name: "Constructora Ejemplo" })).toBeVisible();

  // Un cliente con obras no se elimina (se archiva).
  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(/tiene obras: archivalo/)).toBeVisible();
});
