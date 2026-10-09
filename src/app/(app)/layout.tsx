import Image from "next/image";
import { Suspense } from "react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Buscador } from "@/components/shell/buscador";
import { MenuUsuario } from "@/components/shell/menu-usuario";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
          <Image src="/logo.svg" alt="PAS Piedra Angular Solutions" width={64} height={35} className="shrink-0 md:hidden" priority />
          <Buscador />
          <div className="ml-auto shrink-0">
            <Suspense fallback={<span className="block size-9 animate-pulse rounded-full bg-muted" />}>
              <MenuUsuario />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
