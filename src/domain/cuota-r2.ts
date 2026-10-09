// Cuota de Cloudflare R2 (free tier). Cloudflare no permite poner un tope de gasto, así que la
// app cuenta lo que usa y bloquea antes de pasarse, salvo que un admin apruebe el excedente.

export const FREE_TIER = {
  almacenamiento: 10 * 1024 ** 3, // 10 GB-mes
  opsA: 1_000_000, // escrituras / listados
  opsB: 10_000_000, // lecturas
} as const;

/** Margen para lo que no pasa por la app (backups, reintentos, URLs firmadas reusadas). */
export const MARGEN = 0.8;

export type Recurso = keyof typeof FREE_TIER;
export type Uso = Record<Recurso, number>;

export const LIMITES_BASE: Uso = {
  almacenamiento: Math.floor(FREE_TIER.almacenamiento * MARGEN),
  opsA: Math.floor(FREE_TIER.opsA * MARGEN),
  opsB: Math.floor(FREE_TIER.opsB * MARGEN),
};

export const NOMBRE: Record<Recurso, string> = {
  almacenamiento: "Almacenamiento",
  opsA: "Operaciones de escritura (clase A)",
  opsB: "Operaciones de lectura (clase B)",
};

/** Límite efectivo: el base, o el que aprobó un admin para este mes si es mayor. */
export function limites(aprobado?: Partial<Uso> | null): Uso {
  return {
    almacenamiento: Math.max(LIMITES_BASE.almacenamiento, aprobado?.almacenamiento ?? 0),
    opsA: Math.max(LIMITES_BASE.opsA, aprobado?.opsA ?? 0),
    opsB: Math.max(LIMITES_BASE.opsB, aprobado?.opsB ?? 0),
  };
}

/** Recursos que se pasarían del límite si se suma `nuevo` a `usado`. Vacío = permitido. */
export function excedidos(usado: Uso, nuevo: Partial<Uso>, limite: Uso): Recurso[] {
  return (Object.keys(limite) as Recurso[]).filter((r) => (nuevo[r] ?? 0) > 0 && usado[r] + (nuevo[r] ?? 0) > limite[r]);
}

/** Mes de facturación (UTC, como Cloudflare): "2026-10". */
export const mesFacturacion = (d = new Date()) => d.toISOString().slice(0, 7);

/** Costo estimado en USD de lo usado por encima del free tier (tarifas publicadas de R2). */
export function costoEstimado(usado: Uso) {
  const sobre = (r: Recurso) => Math.max(0, usado[r] - FREE_TIER[r]);
  return (sobre("almacenamiento") / 1024 ** 3) * 0.015 + (sobre("opsA") / 1e6) * 4.5 + (sobre("opsB") / 1e6) * 0.36;
}

const dec = (n: number, d: number) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** "2,33 GB" (formato es-AR). */
export function formatearBytes(b: number) {
  if (b < 1024 ** 2) return `${dec(b / 1024, 0)} KB`;
  if (b < 1024 ** 3) return `${dec(b / 1024 ** 2, 1)} MB`;
  return `${dec(b / 1024 ** 3, 2)} GB`;
}
