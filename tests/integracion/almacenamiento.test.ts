import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { archivos, r2UsoMensual } from "@/db/schema";
import { LIMITES_BASE, mesFacturacion } from "@/domain/cuota-r2";
import { confirmarSubida, eliminarArchivo, guardarArchivo, prepararSubida, urlDescarga } from "@/services/almacenamiento";
import { CuotaExcedida } from "@/services/cuota-r2";

// Flujo completo contra el mock S3 de docker compose (misma API que R2).
const meta = { nombre: "prueba.pdf", mime: "application/pdf" };
const PDF = "%PDF-1.4 prueba";
const texto = (s: string) => new TextEncoder().encode(s);
const uso = async () => (await db.select().from(r2UsoMensual))[0];

beforeEach(async () => {
  await db.execute(sql`truncate r2_uso_mensual, archivos cascade`);
});

describe("almacenamiento", () => {
  it("guarda desde el servidor, cuenta operaciones y descarga con URL firmada", async () => {
    const id = await guardarArchivo(texto("hola PAS"), meta);
    const [a] = await db.select().from(archivos).where(eq(archivos.id, id));
    expect(a).toMatchObject({ estado: "ok", bytes: 8 });
    expect((await uso()).opsA).toBe(1);

    const res = await fetch(await urlDescarga(id));
    expect(await res.text()).toBe("hola PAS");
    expect((await uso()).opsB).toBe(1);
  });

  it("subida directa del navegador: reserva, PUT a la URL firmada y confirmación", async () => {
    const { archivoId, url } = await prepararSubida(PDF.length, meta);
    expect((await fetch(url, { method: "PUT", body: PDF })).ok).toBe(true);
    await confirmarSubida(archivoId);
    const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
    expect(a.estado).toBe("ok");
  });

  it("si suben más de lo declarado, se borra", async () => {
    const { archivoId, url } = await prepararSubida(3, meta);
    await fetch(url, { method: "PUT", body: "mucho más de tres bytes" });
    await expect(confirmarSubida(archivoId)).rejects.toThrow(/no coincide/);
    const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
    expect(a.deletedAt).not.toBeNull();
  });

  it("un texto disfrazado de PDF se rechaza y se borra", async () => {
    const falso = "no soy un PDF";
    const { archivoId, url } = await prepararSubida(falso.length, meta);
    await fetch(url, { method: "PUT", body: falso });
    await expect(confirmarSubida(archivoId)).rejects.toThrow(/no corresponde a su tipo/);
    const [a] = await db.select().from(archivos).where(eq(archivos.id, archivoId));
    expect(a.deletedAt).not.toBeNull();
  });

  it("tipos no permitidos ni siquiera reservan", async () => {
    await expect(prepararSubida(10, { nombre: "x.exe", mime: "application/x-msdownload" })).rejects.toThrow(/no permitido/);
  });

  it("sin cupo no sube nada ni deja registros", async () => {
    await db.insert(r2UsoMensual).values({ mes: mesFacturacion(), opsA: LIMITES_BASE.opsA });
    await expect(guardarArchivo(texto("x"), meta)).rejects.toBeInstanceOf(CuotaExcedida);
    expect(await db.select().from(archivos)).toHaveLength(0);
  });

  it("eliminar libera el espacio", async () => {
    const id = await guardarArchivo(texto("chau"), meta);
    await eliminarArchivo(id);
    await expect(urlDescarga(id)).rejects.toThrow(/no existe/);
  });
});
