import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Breadcrumbs: Clientes / Constructora Ejemplo / Av. Córdoba 1234 (spec/02 §4). */
export function Migas({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Ubicación" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
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
