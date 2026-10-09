"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./nav-items";

// usePathname no se conoce al prerenderizar rutas dinámicas: el fallback es la misma
// navegación sin ítem activo, así no hay salto visual.
export function Sidebar() {
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
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex md:w-18 lg:w-60">
      <div className="flex h-16 items-center px-5 md:justify-center md:px-0 lg:justify-start lg:px-5">
        <Image src="/logo-alt.svg" alt="PAS Piedra Angular Solutions" width={88} height={48} priority className="md:hidden lg:block" />
        <Image src="/icon.svg" alt="PAS" width={36} height={36} className="hidden md:block lg:hidden" />
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {navItems.map(({ href, label, icon: Icon, enabled }) => {
          const active = isActive(pathname, href);
          const classes = cn(
            "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors md:justify-center lg:justify-start",
            active && "bg-sidebar-accent font-semibold",
            active && "before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary",
            enabled ? "hover:bg-sidebar-accent" : "cursor-not-allowed opacity-40",
          );
          const content = (
            <>
              <Icon className={cn("size-5 shrink-0", active && "text-sidebar-primary")} aria-hidden />
              <span className="md:sr-only lg:not-sr-only">{label}</span>
            </>
          );
          return enabled ? (
            <Link key={href} href={href} className={classes} aria-current={active ? "page" : undefined}>
              {content}
            </Link>
          ) : (
            <span key={href} className={classes} aria-disabled title={`${label} · próximamente`}>
              {content}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
