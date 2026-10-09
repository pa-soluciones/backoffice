import { describe, expect, it } from "vitest";
import { alcanceDe, permisosEfectivos, todosLosPermisos } from "./permisos";

describe("permisosEfectivos", () => {
  it("eliminar implica escribir y leer", () => {
    const p = permisosEfectivos([{ modulo: "clientes", accion: "eliminar", alcance: "todos" }]);
    expect(alcanceDe(p, "clientes", "leer")).toBe("todos");
    expect(alcanceDe(p, "clientes", "escribir")).toBe("todos");
    expect(alcanceDe(p, "obras", "leer")).toBeNull();
  });

  it("ver_montos implica leer pero no escribir", () => {
    const p = permisosEfectivos([{ modulo: "presupuestos", accion: "ver_montos", alcance: "todos" }]);
    expect(alcanceDe(p, "presupuestos", "leer")).toBe("todos");
    expect(alcanceDe(p, "presupuestos", "escribir")).toBeNull();
  });

  it("la unión de rol + directo: todos gana sobre asignados", () => {
    const p = permisosEfectivos([
      { modulo: "presupuestos", accion: "leer", alcance: "asignados" },
      { modulo: "presupuestos", accion: "escribir", alcance: "todos" },
    ]);
    expect(alcanceDe(p, "presupuestos", "leer")).toBe("todos");
  });

  it("asignados se mantiene si nadie da todos", () => {
    const p = permisosEfectivos([{ modulo: "campo", accion: "escribir", alcance: "asignados" }]);
    expect(alcanceDe(p, "campo", "leer")).toBe("asignados");
  });

  it("módulos no asignables siempre quedan con alcance todos", () => {
    const p = permisosEfectivos([{ modulo: "stock", accion: "leer", alcance: "asignados" }]);
    expect(alcanceDe(p, "stock", "leer")).toBe("todos");
  });

  it("ignora acciones que el módulo no tiene", () => {
    const p = permisosEfectivos([{ modulo: "finanzas", accion: "eliminar", alcance: "todos" }]);
    expect(alcanceDe(p, "finanzas", "leer")).toBeNull();
  });

  it("todosLosPermisos cubre cada acción de cada módulo", () => {
    const p = permisosEfectivos(todosLosPermisos());
    expect(alcanceDe(p, "auditoria", "leer")).toBe("todos");
    expect(alcanceDe(p, "documentos", "emitir")).toBe("todos");
    expect(alcanceDe(p, "auditoria", "escribir")).toBeNull();
  });
});
