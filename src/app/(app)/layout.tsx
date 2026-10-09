import Image from "next/image";
import { Search } from "lucide-react";
import { Suspense } from "react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MenuUsuario } from "@/components/shell/menu-usuario";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
          <Image src="/logo.svg" alt="PAS Piedra Angular Solutions" width={64} height={35} className="md:hidden" priority />
          {/* Buscador global: se habilita con el módulo de clientes/obras (spec/04 §6). */}
          <div
            aria-disabled
            className="flex h-10 w-full max-w-md cursor-not-allowed items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground opacity-60 md:ml-0"
          >
            <Search className="size-4" aria-hidden />
            <span className="truncate">Buscar presupuesto, dirección, director…</span>
            <kbd className="ml-auto hidden rounded border px-1.5 text-xs md:inline">Ctrl K</kbd>
          </div>
          <div className="ml-auto">
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
