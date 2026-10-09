import type { Metadata } from "next";
import { Suspense } from "react";
import { vapidPublica } from "@/lib/push";
import { misNotificaciones, misPreferencias } from "@/services/notificaciones";
import { ActivarPush, FormPreferencias, ListaNotificaciones } from "./componentes";

export const metadata: Metadata = { title: "Notificaciones" };

async function Contenido() {
  const [items, prefs] = await Promise.all([misNotificaciones(), misPreferencias()]);
  return (
    <>
      <ListaNotificaciones items={items} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cómo te avisamos</h2>
        <ActivarPush clave={vapidPublica()} />
        <FormPreferencias prefs={prefs} />
      </section>
    </>
  );
}

export default function NotificacionesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Notificaciones</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
