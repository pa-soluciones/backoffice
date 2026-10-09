import "server-only";
import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { presupuestoAsignados, presupuestos } from "@/db/schema";
import { codigoPresupuesto } from "@/domain/codigos";
import type { Accion, Modulo } from "@/domain/permisos";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Acceso a un presupuesto concreto (permiso + alcance). Compartido por presupuestos y documentos.

export const codigo = (p: { anio: number | null; numero: number | null }) =>
  p.anio && p.numero ? codigoPresupuesto(p.anio, p.numero) : null;

/** Filtro SQL del alcance "asignados" (spec/03 §5.4). */
export function soloAsignados(userId: string): SQL {
  return exists(
    db
      .select({ x: sql`1` })
      .from(presupuestoAsignados)
      .where(and(eq(presupuestoAsignados.presupuestoId, presupuestos.id), eq(presupuestoAsignados.userId, userId))),
  );
}

/** Permiso + alcance sobre un presupuesto concreto. */
export async function acceso(presupuestoId: string, modulo: Modulo, accion: Accion) {
  const r = await requirePermiso(modulo, accion);
  if (r.alcance === "asignados") {
    const [a] = await db
      .select({ x: presupuestoAsignados.userId })
      .from(presupuestoAsignados)
      .where(and(eq(presupuestoAsignados.presupuestoId, presupuestoId), eq(presupuestoAsignados.userId, r.usuario.id)));
    if (!a) throw new ErrorNegocio("No estás asignado a este presupuesto.");
  }
  return r;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de presupuesto a partir de un id o un código legible ("2026/0105", "2026/105"). */
export async function presupuestoPorRef(ref: string) {
  const r = ref.trim();
  if (UUID.test(r)) return r;
  const m = r.match(/^(\d{4})\/0*(\d+)/);
  if (!m) throw new ErrorNegocio(`"${ref}" no es un código de presupuesto (ej. 2026/0105).`);
  const [p] = await db.select({ id: presupuestos.id }).from(presupuestos).where(and(eq(presupuestos.anio, Number(m[1])), eq(presupuestos.numero, Number(m[2]))));
  if (!p) throw new ErrorNegocio(`No existe el presupuesto ${ref}.`);
  return p.id;
}
