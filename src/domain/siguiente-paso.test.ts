import { describe, expect, it } from "vitest";
import { siguientePaso, type ContextoPaso } from "./siguiente-paso";

const base: ContextoPaso = {
  estado: "prospecto",
  tieneItems: false,
  borrador: true,
  requiereVisita: false,
  visitaResuelta: false,
  visitaAgendada: false,
  ofertaVencida: false,
  excedente: 0,
  anticipoPendiente: false,
  porCobrar: 0,
  materialesEnObra: 0,
};

describe("siguiente paso", () => {
  it("prospecto: visita, ítems, emisión", () => {
    expect(siguientePaso({ ...base, requiereVisita: true })?.texto).toMatch(/visita técnica/);
    expect(siguientePaso(base)?.texto).toMatch(/ítems/);
    expect(siguientePaso({ ...base, tieneItems: true })?.texto).toMatch(/emití/);
  });

  it("en progreso: el excedente pesa más que el anticipo", () => {
    const r = siguientePaso({ ...base, estado: "en_progreso", excedente: 5, anticipoPendiente: true });
    expect(r).toEqual({ tono: "alerta", texto: "5 perforaciones ejecutadas sin cotizar: cubrilas con un adicional.", pestana: "obra" });
    expect(siguientePaso({ ...base, estado: "en_progreso", anticipoPendiente: true })?.pestana).toBe("dinero");
  });

  it("oferta vencida y liquidación", () => {
    expect(siguientePaso({ ...base, estado: "en_espera", ofertaVencida: true })?.tono).toBe("alerta");
    expect(siguientePaso({ ...base, estado: "pendiente_liquidacion", porCobrar: 0 })?.tono).toBe("ok");
    expect(siguientePaso({ ...base, estado: "terminado" })).toBeNull();
  });
});
