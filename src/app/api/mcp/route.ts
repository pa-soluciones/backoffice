import { createMcpHandler } from "mcp-handler";
import { connection } from "next/server";
import { registrarHerramientas } from "@/mcp/servidor";
import { ejecutarComoToken } from "@/services/contexto";
import { autenticarToken } from "@/services/mcp";

// Servidor MCP (spec/11): Streamable HTTP con token personal `Authorization: Bearer pas_…`.
// Toda la llamada corre "como" el dueño del token: los services aplican sus permisos y auditan con source mcp.

const mcp = createMcpHandler(registrarHerramientas, { serverInfo: { name: "pas-backoffice", version: "1.0.0" } });

async function handler(req: Request) {
  await connection();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const a = await autenticarToken(req.headers.get("authorization"), ip);
  if (!a.ok) {
    return Response.json({ error: a.mensaje }, { status: a.status, headers: a.status === 401 ? { "WWW-Authenticate": 'Bearer realm="pas-backoffice"' } : {} });
  }
  return ejecutarComoToken(a.contexto, () => mcp(req));
}

export { handler as DELETE, handler as GET, handler as POST };
