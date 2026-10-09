"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./nav-items";

// "Más" lleva al resto de los módulos que no entran en la barra.
const items = [...navItems.filter((i) => i.mobile), { href: "/mas", label: "Más", icon: Menu, enabled: true }];

// usePathname no se conoce al prerenderizar rutas dinámicas: el fallback es la misma
// navegación sin ítem activo, así no hay salto visual.
export function BottomNav() {
  return (
    <Suspense fallback={<Vista pathname="" />}>
      <ConRuta />
    </Suspense>
  );
}

function ConRuta() {
  return <Vista pathname={usePathname()} />;
}

function Vista({ pathname }: { pathname: string }) {

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      {items.map(({ href, label, icon: Icon, enabled }) => {
        const active =
          href === "/mas"
            ? pathname === "/mas" || navItems.some((i) => !i.mobile && isActive(pathname, i.href))
            : isActive(pathname, href);
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
