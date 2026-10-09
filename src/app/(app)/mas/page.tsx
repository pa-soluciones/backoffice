import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { navItems } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: "Más" };

// Mobile: módulos que no entran en la barra inferior.
export default function MasPage() {
  const items = navItems.filter((i) => !i.mobile);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Más</h1>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map(({ href, label, icon: Icon, enabled }) => (
          <li key={href}>
            {enabled ? (
              <Link href={href} className="flex min-h-14 items-center gap-4 px-4 hover:bg-muted/60">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="flex-1 font-semibold">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : (
              <span aria-disabled className="flex min-h-14 items-center gap-4 px-4 text-muted-foreground">
                <Icon className="size-5" aria-hidden />
                <span className="flex-1">{label}</span>
                <span className="text-xs">Próximamente</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
