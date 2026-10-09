import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Breadcrumbs: Clientes / Constructora Ejemplo / Av. Córdoba 1234 (spec/02 §4).
 * En mobile se reduce a "‹ nivel anterior" para no ocupar dos renglones.
 */
export function Migas({ items }: { items: { href?: string; label: string }[] }) {
  const anterior = [...items].reverse().find((it) => it.href);
  return (
    <nav aria-label="Ubicación" className="text-sm text-muted-foreground">
      {anterior && (
        <Link href={anterior.href!} className="inline-flex max-w-full items-center gap-1 hover:text-foreground sm:hidden">
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{anterior.label}</span>
        </Link>
      )}
      <ol className="hidden flex-wrap items-center gap-1 sm:flex">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {it.href ? (
              <Link href={it.href} className="truncate hover:text-foreground hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-foreground">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
