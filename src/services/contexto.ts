import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Usuario } from "./sesion";

// Contexto de una llamada MCP (spec/11): el usuario dueño del token reemplaza a la sesión de
// Better Auth. Los services no cambian: sesion.ts y auditoria.ts lo leen de acá.

export type ContextoMcp = { usuario: Usuario; tokenId: string; tokenNombre: string; ip: string | null };

const almacen = new AsyncLocalStorage<ContextoMcp>();

export const contextoMcp = () => almacen.getStore() ?? null;
export const ejecutarComoToken = <T>(ctx: ContextoMcp, fn: () => T) => almacen.run(ctx, fn);
