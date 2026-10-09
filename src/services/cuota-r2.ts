import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { archivos, r2UsoMensual } from "@/db/schema";
import {
  costoEstimado,
  excedidos,
  FREE_TIER,
  formatearBytes,
  LIMITES_BASE,
  limites,
  mesFacturacion,
  NOMBRE,
  type Recurso,
  type Uso,
} from "@/domain/cuota-r2";
import { auditar } from "./auditoria";
import { emailAAdmins } from "./avisos";
import { ErrorNegocio } from "./errores";
import { esAdmin, requirePermiso } from "./sesion";

// Guarda del free tier de R2: toda operación sobre el bucket reserva cupo acá antes de ejecutarse.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export class CuotaExcedida extends ErrorNegocio {}

async function filaMes(tx: Tx | typeof db, mes: string) {
  await tx.insert(r2UsoMensual).values({ mes }).onConflictDoNothing();
  const [f] = await tx.select().from(r2UsoMensual).where(eq(r2UsoMensual.mes, mes));
  return f;
}

async function almacenamientoUsado(tx: Tx | typeof db) {
  const [r] = await tx.select({ b: sql<string>`coalesce(sum(${archivos.bytes}), 0)` }).from(archivos).where(isNull(archivos.deletedAt));
  return Number(r.b);
}

/** Bloquea, avisa a los admins (una vez por mes y recurso) y lanza el error para el usuario. */
async function bloquear(mes: string, recursos: Recurso[]): Promise<never> {
  // Reclamo atómico del aviso: con rechazos simultáneos, solo uno manda el email.
  const nuevos: Recurso[] = [];
  for (const r of recursos) {
    const ganado = await db
      .update(r2UsoMensual)
      .set({ avisados: sql`${r2UsoMensual.avisados} || ${JSON.stringify([r])}::jsonb` })
      .where(and(eq(r2UsoMensual.mes, mes), sql`not (${r2UsoMensual.avisados} ? ${r})`))
      .returning({ mes: r2UsoMensual.mes });
    if (ganado.length) nuevos.push(r);
  }
  if (nuevos.length) {
    await auditar({ source: "system", action: "r2.cuota_alcanzada", entityType: "r2", entityId: mes, diff: { recursos } });
    await emailAAdmins("Límite gratuito de almacenamiento alcanzado · PAS Backoffice", {
      categoria: "Almacenamiento",
      titulo: "Se alcanzó el límite gratuito de Cloudflare R2",
      parrafos: [
        `Llegamos al límite que configuramos para no generar cargos: ${recursos.map((r) => NOMBRE[r]).join(", ")}.`,
        "Las subidas o descargas de archivos quedan bloqueadas hasta que un administrador apruebe el excedente (puede generar cargos en la tarjeta) o hasta que empiece el mes que viene.",
      ],
      boton: { texto: "Revisar almacenamiento", url: `${appUrl()}/ajustes/almacenamiento` },
    });
  }
  throw new CuotaExcedida(
    `Se alcanzó el límite gratuito de almacenamiento (${recursos.map((r) => NOMBRE[r].toLowerCase()).join(", ")}). Un administrador tiene que aprobar el excedente en Ajustes → Almacenamiento.`,
  );
}

/** Reserva n operaciones (A = escritura, B = lectura). Atómico: el UPDATE solo suma si entra. */
export async function reservarOperaciones(tipo: "opsA" | "opsB", n = 1) {
  const mes = mesFacturacion();
  const f = await filaMes(db, mes);
  const limite = limites(f.aprobado as Partial<Uso> | null)[tipo];
  const col = tipo === "opsA" ? r2UsoMensual.opsA : r2UsoMensual.opsB;
  const ok = await db
    .update(r2UsoMensual)
    .set({ [tipo]: sql`${col} + ${n}` })
    .where(and(eq(r2UsoMensual.mes, mes), sql`${col} + ${n} <= ${limite}`))
    .returning({ mes: r2UsoMensual.mes });
  if (!ok.length) await bloquear(mes, [tipo]);
}

/**
 * Reserva espacio para un archivo nuevo: inserta el registro (pendiente) dentro de una
 * transacción serializada con un advisory lock, así dos subidas simultáneas no se pasan juntas.
 */
export async function reservarAlmacenamiento(valores: typeof archivos.$inferInsert) {
  const mes = mesFacturacion();
  const resultado = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('r2_almacenamiento'))`);
    const f = await filaMes(tx, mes);
    const usado = await almacenamientoUsado(tx);
    const limite = limites(f.aprobado as Partial<Uso> | null);
    if (excedidos({ almacenamiento: usado, opsA: 0, opsB: 0 }, { almacenamiento: valores.bytes }, limite).length) {
      return { bloqueado: true as const };
    }
    const [a] = await tx.insert(archivos).values(valores).returning();
    return { bloqueado: false as const, archivo: a };
  });
  if (resultado.bloqueado) await bloquear(mes, ["almacenamiento"]);
  return resultado.archivo!;
}

// ── Pantalla de Ajustes ───────────────────────────────────────────────────────

export async function estadoCuota() {
  await requirePermiso("configuracion", "leer");
  const mes = mesFacturacion();
  const f = await filaMes(db, mes);
  const usado: Uso = { almacenamiento: await almacenamientoUsado(db), opsA: f.opsA, opsB: f.opsB };
  return {
    mes,
    usado,
    limite: limites(f.aprobado as Partial<Uso> | null),
    base: LIMITES_BASE,
    freeTier: FREE_TIER,
    aprobadoAt: f.aprobadoAt,
    costoEstimado: costoEstimado(usado),
  };
}

/** Un admin amplía los límites del mes, aceptando que puede haber cargos. Auditado. */
export async function aprobarExcedente(nuevo: Partial<Uso>) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  if (!(await esAdmin(usuario.id))) throw new ErrorNegocio("Solo un administrador puede aprobar un excedente.");
  const mes = mesFacturacion();
  const f = await filaMes(db, mes);
  const aprobado = { ...(f.aprobado as Partial<Uso> | null), ...nuevo };
  await db.update(r2UsoMensual).set({ aprobado, aprobadoPor: usuario.id, aprobadoAt: new Date(), avisados: [] }).where(eq(r2UsoMensual.mes, mes));
  await auditar({
    actorUserId: usuario.id,
    action: "r2.excedente_aprobado",
    entityType: "r2",
    entityId: mes,
    diff: { aprobado, almacenamiento: nuevo.almacenamiento ? formatearBytes(nuevo.almacenamiento) : undefined },
  });
}
