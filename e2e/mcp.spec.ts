import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN } from "../playwright.config";
import { crearPresupuestoConItem, primerInicioAdmin, resetearBase, sql } from "./helpers";

// spec/11 §4: token personal, permisos del usuario, dry-run, auditoría y revocación.

/** Llamada JSON-RPC al endpoint MCP (Streamable HTTP); acepta respuesta JSON o SSE. */
async function mcp(request: APIRequestContext, token: string, method: string, params: object = {}) {
  const res = await request.post("/api/mcp", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
    data: { jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method, params },
  });
  const texto = await res.text();
  const json = texto.trim().startsWith("{") ? JSON.parse(texto) : JSON.parse(texto.split("\n").find((l) => l.startsWith("data:"))!.slice(5));
  return { status: res.status(), json };
}
const tool = async (request: APIRequestContext, token: string, name: string, args: object = {}) => {
  const r = await mcp(request, token, "tools/call", { name, arguments: args });
  const c = r.json.result;
  return { error: !!c?.isError, texto: c?.content?.[0]?.text as string, datos: c && !c.isError ? JSON.parse(c.content[0].text) : null };
};

test("MCP: token del admin, operario sin acceso ni montos, dry-run, auditoría y revocación", async ({ page, request }) => {
  test.setTimeout(120_000);
  await resetearBase();
  page.on("dialog", (d) => d.accept());
  await primerInicioAdmin(page, ADMIN);
  await crearPresupuestoConItem(page);

  // Token desde Mi perfil: se muestra una sola vez, con la configuración para Claude Desktop.
  await page.goto("/perfil");
  await page.getByLabel("Nombre").fill("Claude Desktop notebook");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.locator("code").first().textContent())!;
  expect(token).toMatch(/^pas_/);
  await expect(page.getByText('"mcp-remote"')).toBeVisible();

  const init = await mcp(request, token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } });
  expect(init.json.result.serverInfo.name).toBe("pas-backoffice");
  const lista = await mcp(request, token, "tools/list");
  const nombres: string[] = lista.json.result.tools.map((t: { name: string }) => t.name);
  expect(nombres).toContain("listar_presupuestos");
  expect(nombres.some((n) => n.startsWith("eliminar"))).toBe(false);

  // "¿Qué presupuestos de Constructora Ejemplo hay?" → buscar + listar con montos.
  const [p] = (await tool(request, token, "listar_presupuestos", { estado: "prospecto" })).datos;
  expect(p.codigo).toMatch(/^\d{4}\/0001$/);
  expect(p.cliente).toBe("Constructora Ejemplo");

  // emitir_documento sin confirmar no emite.
  const sim = await tool(request, token, "emitir_documento", { presupuesto: p.codigo });
  expect(sim.datos.simulacion).toBe(true);
  const [{ n }] = await sql`select count(*)::int n from presupuesto_revisiones where estado = 'emitida'`;
  expect(n).toBe(0);

  // Escritura: queda auditada como mcp con el nombre del token.
  const cli = await tool(request, token, "crear_cliente", { razonSocial: "Obras del Sur SA" });
  expect(cli.error).toBe(false);
  const [a] = await sql`select source, diff->>'token' as token, mcp_token_id from audit_log where action = 'cliente.crear' order by id desc limit 1`;
  expect(a.source).toBe("mcp");
  expect(a.token).toBe("Claude Desktop notebook");

  // Operario (alcance "asignados", sin ver montos): no ve el presupuesto ni puede abrirlo.
  const [rol] = await sql`select id from roles where nombre = 'Operario'`;
  const [op] = await sql`insert into "user" (name, email) values ('Operario Uno', 'op@pas.test') returning id`;
  await sql`insert into user_roles (user_id, role_id) values (${op.id}, ${rol.id})`;
  const tokenOp = "pas_tokendeoperarioparalostests_123456";
  await sql`insert into mcp_tokens (user_id, nombre, token_hash, ultimos4, expires_at) values (${op.id}, 'celular', ${createHash("sha256").update(tokenOp).digest("hex")}, '3456', now() + interval '30 days')`;
  const vacio = await tool(request, tokenOp, "listar_presupuestos");
  expect(vacio.error || vacio.datos.length === 0).toBe(true);
  const ajeno = await tool(request, tokenOp, "obtener_presupuesto", { presupuesto: p.codigo });
  expect(ajeno.error).toBe(true);
  await sql`insert into presupuesto_asignados (presupuesto_id, user_id) select id, ${op.id} from presupuestos`;
  const propio = await tool(request, tokenOp, "obtener_presupuesto", { presupuesto: p.codigo });
  expect(propio.error).toBe(false);
  expect(propio.datos.items[0].precioUnitario).toBeNull();
  expect(propio.datos.totales).toBeNull();

  // Token revocado → 401.
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Revocar" }).click();
  await expect(page.getByText(/^Revocado el/)).toBeVisible();
  expect((await mcp(request, token, "tools/list").catch(() => ({ status: 0, json: {} }))).status).toBe(401);
});
