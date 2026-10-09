import type { Metadata } from "next";
import { Suspense } from "react";
import { pagina as cortar, paginaDe, Paginador, POR_PAGINA } from "@/components/paginador";
import { vapidPublica } from "@/lib/push";
import { misNotificaciones, misPreferencias } from "@/services/notificaciones";
import { ActivarPush, FormPreferencias, ListaNotificaciones } from "./componentes";

export const metadata: Metadata = { title: "Notificaciones" };

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const pag = paginaDe((await searchParams).pagina);
  const [crudo, prefs] = await Promise.all([misNotificaciones(false, { limite: POR_PAGINA + 1, desde: (pag - 1) * POR_PAGINA }), misPreferencias()]);
  const { filas: items, hayMas } = cortar(crudo);
  return (
    <>
      <ListaNotificaciones items={items} />
      <Paginador pagina={pag} hayMas={hayMas} mostrando={items.length} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cómo te avisamos</h2>
        <ActivarPush clave={vapidPublica()} />
        <FormPreferencias prefs={prefs} />
      </section>
    </>
  );
}

export default function NotificacionesPage({ searchParams }: PageProps<"/notificaciones">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Notificaciones</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
