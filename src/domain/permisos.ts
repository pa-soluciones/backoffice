// Modelo de permisos (spec/03-auth-permisos.md §5). Funciones puras, sin DB.

export const ACCIONES = ["leer", "escribir", "eliminar", "cambiar_estado", "emitir", "ver_montos"] as const;
export type Accion = (typeof ACCIONES)[number];
export type Alcance = "todos" | "asignados";

type ModuloDef = { label: string; acciones: readonly Accion[]; asignable: boolean };

export const MODULOS = {
  clientes: { label: "Clientes y directores", acciones: ["leer", "escribir", "eliminar"], asignable: false },
  obras: { label: "Obras", acciones: ["leer", "escribir", "eliminar"], asignable: true },
  presupuestos: {
    label: "Presupuestos",
    acciones: ["leer", "escribir", "eliminar", "cambiar_estado", "ver_montos"],
    asignable: true,
  },
  documentos: { label: "Documentos", acciones: ["leer", "escribir", "eliminar", "emitir"], asignable: true },
  campo: { label: "Campo (perforaciones, fotos)", acciones: ["leer", "escribir", "eliminar"], asignable: true },
  agenda: { label: "Agenda", acciones: ["leer", "escribir", "eliminar"], asignable: true },
  anexos: { label: "Anexos", acciones: ["leer", "escribir", "eliminar"], asignable: true },
  stock: { label: "Stock", acciones: ["leer", "escribir", "eliminar", "ver_montos"], asignable: false },
  gastos: { label: "Gastos", acciones: ["leer", "escribir", "eliminar"], asignable: true },
  cobros: { label: "Cobros", acciones: ["leer", "escribir", "eliminar"], asignable: false },
  finanzas: { label: "Finanzas", acciones: ["leer"], asignable: false },
  usuarios: { label: "Usuarios", acciones: ["leer", "escribir", "eliminar"], asignable: false },
  roles: { label: "Roles", acciones: ["leer", "escribir", "eliminar"], asignable: false },
  configuracion: { label: "Configuración", acciones: ["leer", "escribir"], asignable: false },
  auditoria: { label: "Auditoría", acciones: ["leer"], asignable: false },
  ia: { label: "Asistente IA", acciones: ["escribir"], asignable: false },
  mcp: { label: "Tokens MCP", acciones: ["escribir"], asignable: false },
} as const satisfies Record<string, ModuloDef>;

export type Modulo = keyof typeof MODULOS;

export type Permiso = { modulo: Modulo; accion: Accion; alcance: Alcance };

/** Clave `modulo.accion` → alcance efectivo. */
export type PermisosEfectivos = Map<`${Modulo}.${Accion}`, Alcance>;

// eliminar ⇒ escribir ⇒ leer; las acciones especiales implican leer.
const IMPLICA: Record<Accion, Accion[]> = {
  leer: [],
  escribir: ["leer"],
  eliminar: ["escribir", "leer"],
  cambiar_estado: ["leer"],
  emitir: ["leer"],
  ver_montos: ["leer"],
};

function esValido(p: Permiso) {
  const def: ModuloDef | undefined = MODULOS[p.modulo];
  return !!def && def.acciones.includes(p.accion);
}

/** Unión de permisos de roles + directos, con implicaciones. `todos` gana sobre `asignados`. */
export function permisosEfectivos(permisos: Permiso[]): PermisosEfectivos {
  const out: PermisosEfectivos = new Map();
  for (const p of permisos) {
    if (!esValido(p)) continue;
    const alcance = MODULOS[p.modulo].asignable ? p.alcance : "todos";
    for (const accion of [p.accion, ...IMPLICA[p.accion]]) {
      if (!(MODULOS[p.modulo].acciones as readonly Accion[]).includes(accion)) continue;
      const key = `${p.modulo}.${accion}` as const;
      if (out.get(key) !== "todos") out.set(key, alcance);
    }
  }
  return out;
}

/** Todos los permisos posibles con alcance `todos` (rol de sistema Administrador). */
export function todosLosPermisos(): Permiso[] {
  return (Object.keys(MODULOS) as Modulo[]).flatMap((modulo) =>
    MODULOS[modulo].acciones.map((accion) => ({ modulo, accion, alcance: "todos" as const })),
  );
}

/** Alcance con el que el usuario puede ejecutar la acción, o null si no puede. */
export function alcanceDe(perms: PermisosEfectivos, modulo: Modulo, accion: Accion): Alcance | null {
  return perms.get(`${modulo}.${accion}`) ?? null;
}
