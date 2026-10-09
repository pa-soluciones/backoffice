import "server-only";
import { asc, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { configuracion, numeracionAnual, presupuestos } from "@/db/schema";
import { anioArgentina } from "@/domain/codigos";
import { auditar } from "./auditoria";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Ajustes de presupuestos: valores por defecto y numeración anual (spec/05 §1, §2).

export type DefaultsPresupuesto = {
  validezDias: number;
  anticipoPct: number;
  ivaPct: number;
  formaContratacion: string;
  baseAjuste: string;
};

export const DEFAULTS: DefaultsPresupuesto = {
  validezDias: 7,
  anticipoPct: 40,
  ivaPct: 21,
  formaContratacion: "Ajuste Alzado",
  baseAjuste: "CAC General",
};

const CLAVE = "presupuesto_defaults";

/** Sin permiso: lo usan los servicios al crear presupuestos. */
export async function defaultsPresupuesto(): Promise<DefaultsPresupuesto> {
  const [r] = await db.select().from(configuracion).where(eq(configuracion.clave, CLAVE));
  return { ...DEFAULTS, ...(r?.valor as Partial<DefaultsPresupuesto> | undefined) };
}

export async function guardarDefaults(d: DefaultsPresupuesto) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  const antes = await defaultsPresupuesto();
  await db
    .insert(configuracion)
    .values({ clave: CLAVE, valor: d })
    .onConflictDoUpdate({ target: configuracion.clave, set: { valor: d, updatedAt: new Date() } });
  await auditar({ actorUserId: usuario.id, action: "configuracion.presupuestos", entityType: "configuracion", entityId: CLAVE, diff: { antes, despues: d } });
}

/** Año actual + siguiente (+ los que ya tengan contador), con el próximo número y el mayor usado. */
export async function listarNumeracion() {
  await requirePermiso("configuracion", "leer");
  const actual = anioArgentina();
  const [contadores, usados] = await Promise.all([
    db.select().from(numeracionAnual).orderBy(asc(numeracionAnual.anio)),
    db.select({ anio: presupuestos.anio, max: max(presupuestos.numero) }).from(presupuestos).groupBy(presupuestos.anio),
  ]);
  const anios = [...new Set([actual, actual + 1, ...contadores.map((c) => c.anio)])].filter((a) => a >= actual).sort();
  return anios.map((anio) => {
    const maxUsado = usados.find((u) => u.anio === anio)?.max ?? 0;
    return { anio, proximo: contadores.find((c) => c.anio === anio)?.proximoNumero ?? maxUsado + 1, maxUsado };
  });
}

/** RF-NUM-05: definir el número inicial de un año (no puede pisar números ya usados). */
export async function fijarProximoNumero(anio: number, proximo: number) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  if (anio < anioArgentina()) throw new ErrorNegocio("No se puede cambiar la numeración de años anteriores.");
  if (!Number.isInteger(proximo) || proximo < 1) throw new ErrorNegocio("El número tiene que ser un entero mayor a 0.");
  const [{ m }] = await db.select({ m: max(presupuestos.numero) }).from(presupuestos).where(eq(presupuestos.anio, anio));
  if (m && proximo <= m) throw new ErrorNegocio(`En ${anio} ya se usó hasta el ${m}: el próximo tiene que ser mayor.`);
  await db
    .insert(numeracionAnual)
    .values({ anio, proximoNumero: proximo })
    .onConflictDoUpdate({ target: numeracionAnual.anio, set: { proximoNumero: proximo } });
  await auditar({ actorUserId: usuario.id, action: "configuracion.numeracion", entityType: "numeracion", entityId: String(anio), diff: { proximo } });
}

/**
 * Asigna el próximo número del año dentro de una transacción. El UPDATE bloquea la fila del año,
 * así dos usuarios simultáneos nunca reciben el mismo número (RF-NUM-02).
 */
export async function siguienteNumero(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const anio = anioArgentina();
  await tx.insert(numeracionAnual).values({ anio, proximoNumero: 1 }).onConflictDoNothing();
  const [r] = await tx
    .update(numeracionAnual)
    .set({ proximoNumero: sql`${numeracionAnual.proximoNumero} + 1` })
    .where(eq(numeracionAnual.anio, anio))
    .returning({ numero: sql<number>`${numeracionAnual.proximoNumero} - 1` });
  return { anio, numero: Number(r.numero) };
}
