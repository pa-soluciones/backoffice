import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

export const POR_PAGINA = 50; // spec/12 RNF-12

/** Página actual desde ?pagina= (1 si falta o es inválida). */
export const paginaDe = (v: string | string[] | undefined) => Math.max(1, Math.floor(Number(typeof v === "string" ? v : 1)) || 1);

/**
 * Paginador de listas del servidor. Las consultas piden POR_PAGINA + 1 filas: si vuelve una de
 * más, hay página siguiente (sin contar el total).
 */
export function Paginador({ pagina, hayMas, params = {}, mostrando }: { pagina: number; hayMas: boolean; params?: Record<string, string | undefined>; mostrando: number }) {
  if (pagina === 1 && !hayMas) return null;
  const href = (p: number) => `?${new URLSearchParams(Object.entries({ ...params, pagina: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][])}`;
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const boton = (habilitado: boolean) => cn(buttonVariants({ variant: "outline", size: "sm" }), !habilitado && "pointer-events-none opacity-40");
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {desde}–{desde + mostrando - 1}
        {hayMas ? " de muchos" : ""}
      </span>
      <span className="flex items-center gap-2">
        <Link href={href(pagina - 1)} aria-disabled={pagina === 1} tabIndex={pagina === 1 ? -1 : undefined} className={boton(pagina > 1)}>
          <ChevronLeft data-icon="inline-start" /> Anterior
        </Link>
        <span className="font-semibold tabular-nums" aria-current="page">
          Página {pagina}
        </span>
        <Link href={href(pagina + 1)} aria-disabled={!hayMas} tabIndex={!hayMas ? -1 : undefined} className={boton(hayMas)}>
          Siguiente <ChevronRight data-icon="inline-end" />
        </Link>
      </span>
    </nav>
  );
}

/** Corta la fila extra de la consulta y dice si hay más. */
export function pagina<T>(filas: T[]) {
  return { filas: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA };
}
