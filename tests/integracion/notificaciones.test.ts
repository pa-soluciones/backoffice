import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { notificaciones, presupuestoAsignados, presupuestos, roles, user, userRoles, visitaResponsables, visitas } from "@/db/schema";
import { notificarPresupuesto } from "@/services/notificaciones";
import { ejecutarCronDiario } from "@/services/recordatorios";

// spec/09 §5: destinatarios, agrupación e idempotencia del cron. Sin RESEND_API_KEY (los emails van a consola).
let admin: string, operario: string, presupuestoId: string;

beforeEach(async () => {
  await db.execute(sql`truncate "user", roles, notificaciones, recordatorios_enviados, presupuestos, archivos cascade`);
  [{ id: admin }, { id: operario }] = await db
    .insert(user)
    .values([
      { name: "Admin", email: "admin@pas.test" },
      { name: "Operario", email: "op@pas.test" },
    ])
    .returning({ id: user.id });
  const [rol] = await db.insert(roles).values({ nombre: "Administrador", esSistema: true }).returning();
  await db.insert(userRoles).values({ userId: admin, roleId: rol.id });
  [{ id: presupuestoId }] = await db.insert(presupuestos).values({ anio: 2026, numero: 105, estado: "en_progreso", moneda: "ARS" }).returning({ id: presupuestos.id });
  await db.insert(presupuestoAsignados).values({ presupuestoId, userId: operario });
});

const de = (userId: string) => db.select().from(notificaciones).where(eq(notificaciones.userId, userId));

describe("notificaciones", () => {
  it("un admin recibe el cambio de estado de un presupuesto al que no está asignado; el autor no", async () => {
    await notificarPresupuesto(presupuestoId, operario, { tipo: "cambio_estado", titulo: "2026/0105 pasó a Pendiente liquidación" });
    expect(await de(admin)).toHaveLength(1);
    expect(await de(operario)).toHaveLength(0);
  });

  it("eventos iguales en 10 minutos sobre la misma entidad se agrupan", async () => {
    for (let i = 0; i < 3; i++) await notificarPresupuesto(presupuestoId, admin, { tipo: "excedente", titulo: "Perforaciones sin cotizar" });
    const [n] = await de(operario);
    expect(n.agrupadaCount).toBe(3);
    expect(await de(operario)).toHaveLength(1);
  });

  it("ejecutar el cron dos veces el mismo día no duplica recordatorios", async () => {
    const manana = new Date(Date.now() + 86_400_000);
    const [v] = await db.insert(visitas).values({ presupuestoId, inicio: manana, estado: "agendada", direccion: "Av. Córdoba 1234" }).returning();
    await db.insert(visitaResponsables).values({ visitaId: v.id, userId: operario });
    const r1 = await ejecutarCronDiario();
    const r2 = await ejecutarCronDiario();
    expect(r1.recordatorios.visitas).toBe(1);
    expect(r2.recordatorios.visitas).toBeUndefined();
    const ns = await de(operario);
    expect(ns).toHaveLength(1);
    expect(ns[0].titulo).toMatch(/^Visita técnica mañana/);
    expect(ns[0].emailEstado).toBe("enviado"); // va en el resumen diario
  });
});
