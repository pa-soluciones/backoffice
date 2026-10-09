"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./nav-items";

// "Más" abrirá el resto de módulos cuando existan; por ahora queda deshabilitado.
const items = [
  ...navItems.filter((i) => i.mobile),
  { href: "/mas", label: "Más", icon: Menu, enabled: false },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      {items.map(({ href, label, icon: Icon, enabled }) => {
        const active = isActive(pathname, href);
        const classes = cn(
          "flex h-16 flex-col items-center justify-center gap-1 text-xs",
          active ? "font-semibold text-sidebar-primary" : "text-sidebar-foreground/80",
          !enabled && "opacity-40",
        );
        const content = (
          <>
            <Icon className="size-5" aria-hidden />
            {label}
          </>
        );
        return enabled ? (
          <Link key={href} href={href} className={classes} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <span key={href} className={classes} aria-disabled>
            {content}
          </span>
        );
      })}
    </nav>
  );
}
