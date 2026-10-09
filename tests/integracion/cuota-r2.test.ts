import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { archivos, r2UsoMensual } from "@/db/schema";
import { LIMITES_BASE, mesFacturacion } from "@/domain/cuota-r2";
import { CuotaExcedida, reservarAlmacenamiento, reservarOperaciones } from "@/services/cuota-r2";

// La guarda del free tier es plata: se prueba contra Postgres real, con concurrencia.
const mes = mesFacturacion();
const MB = 1024 ** 2;

beforeEach(async () => {
  await db.execute(sql`truncate r2_uso_mensual, archivos cascade`);
});

describe("reservarOperaciones", () => {
  it("con 10 lugares libres y 30 pedidos simultáneos, pasan exactamente 10", async () => {
    await db.insert(r2UsoMensual).values({ mes, opsA: LIMITES_BASE.opsA - 10 });
    const r = await Promise.allSettled(Array.from({ length: 30 }, () => reservarOperaciones("opsA")));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(10);
    const rechazos = r.filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(rechazos.every((x) => x.reason instanceof CuotaExcedida)).toBe(true);
    const [f] = await db.select().from(r2UsoMensual);
    expect(f.opsA).toBe(LIMITES_BASE.opsA);
    expect(f.avisados).toEqual(["opsA"]);
  });

  it("con el excedente aprobado por un admin, sigue funcionando", async () => {
    await db.insert(r2UsoMensual).values({ mes, opsA: LIMITES_BASE.opsA, aprobado: { opsA: LIMITES_BASE.opsA + 100 } });
    await expect(reservarOperaciones("opsA")).resolves.toBeUndefined();
  });

  it("las lecturas tienen su propio límite", async () => {
    await db.insert(r2UsoMensual).values({ mes, opsA: LIMITES_BASE.opsA });
    await expect(reservarOperaciones("opsB")).resolves.toBeUndefined();
    await expect(reservarOperaciones("opsA")).rejects.toBeInstanceOf(CuotaExcedida);
  });
});

describe("reservarAlmacenamiento", () => {
  const archivo = (bytes: number, i = 0) => ({ r2Key: `test/${i}-${Math.random()}`, nombre: "x.pdf", mime: "application/pdf", bytes });

  it("con 5 MB libres y 5 subidas simultáneas de 2 MB, entran exactamente 2", async () => {
    await db.insert(archivos).values({ ...archivo(LIMITES_BASE.almacenamiento - 5 * MB), estado: "ok" });
    const r = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => reservarAlmacenamiento(archivo(2 * MB, i + 1))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(2);
    const [{ total }] = await db.select({ total: sql<string>`sum(bytes)` }).from(archivos);
    expect(Number(total)).toBeLessThanOrEqual(LIMITES_BASE.almacenamiento);
  });

  it("los archivos borrados liberan espacio", async () => {
    await db.insert(archivos).values({ ...archivo(LIMITES_BASE.almacenamiento), estado: "ok", deletedAt: new Date() });
    await expect(reservarAlmacenamiento(archivo(MB, 9))).resolves.toMatchObject({ estado: "pendiente" });
  });
});
