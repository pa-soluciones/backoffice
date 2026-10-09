import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/09: campana con contador, lectura, preferencias y cron protegido.
test("notificaciones: campana, leer y preferencias; cron con secreto", async ({ page, request }) => {
  await resetearBase();
  await primerInicioAdmin(page, ADMIN);
  const [{ uid }] = await sql`select id as uid from "user" limit 1`;
  await sql`insert into notificaciones (user_id, tipo, titulo, cuerpo, link) values
    (${uid}, 'cambio_estado', '2026/0105 pasó a En progreso', 'Confirmado el 01/10', '/presupuestos'),
    (${uid}, 'stock_bajo', '2 artículos bajo el stock mínimo', null, '/stock')`;

  await page.goto("/");
  await page.getByRole("link", { name: "Notificaciones: 2 sin leer" }).click();
  await expect(page.getByRole("heading", { name: "Notificaciones", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /2 artículos bajo el stock mínimo/ }).click();
  await expect(page).toHaveURL(/\/stock$/);
  await expect(page.getByRole("link", { name: "Notificaciones: 1 sin leer" })).toBeVisible();

  await page.goto("/notificaciones");
  await page.getByRole("button", { name: "Marcar todas como leídas" }).click();
  await expect(page.getByRole("link", { name: "Notificaciones", exact: true })).toBeVisible();

  await page.getByLabel("Cobros y saldos: email").uncheck();
  await page.getByRole("button", { name: "Guardar preferencias" }).click();
  await expect(page.getByText("Preferencias guardadas.")).toBeVisible();
  const [p] = await sql`select notificaciones from preferencias_usuario`;
  expect(p.notificaciones.cobros).toEqual({ push: false, email: false });

  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  const ok = await request.get("/api/cron/daily", { headers: { Authorization: "Bearer cron-e2e" } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
