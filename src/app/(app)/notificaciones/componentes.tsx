"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { canales, CATEGORIAS, EVENTOS, type Categoria, type Preferencias } from "@/domain/notificaciones";
import { useAccion } from "@/hooks/use-accion";
import { accionDesuscribirPush, accionMarcarLeidas, accionPreferencias, accionSuscribirPush } from "./actions";

type N = { id: string; titulo: string; cuerpo: string | null; link: string | null; leidaAt: Date | null; updatedAt: Date };
const hora = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export function ListaNotificaciones({ items }: { items: N[] }) {
  const [pending, start] = useTransition();
  const sinLeer = items.filter((n) => !n.leidaAt);
  return (
    <div className="space-y-3">
      {sinLeer.length > 0 && (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(() => accionMarcarLeidas("todas"))}>
          Marcar todas como leídas
        </Button>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No tenés notificaciones.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {items.map((n) => (
            <li key={n.id} className={n.leidaAt ? "" : "bg-primary/5"}>
              <Link href={n.link ?? "/notificaciones"} onClick={() => !n.leidaAt && void accionMarcarLeidas([n.id])} className="flex gap-3 p-3 hover:bg-muted">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.leidaAt ? "bg-transparent" : "bg-primary"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.leidaAt ? "" : "font-semibold"}`}>
                    {n.titulo}
                    {!n.leidaAt && <span className="sr-only"> (sin leer)</span>}
                  </span>
                  {n.cuerpo && <span className="block truncate text-muted-foreground">{n.cuerpo}</span>}
                  <span className="block text-xs text-muted-foreground">{hora.format(n.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Canales por categoría (RF-NOT-01). In-app no se apaga. */
export function FormPreferencias({ prefs }: { prefs: Preferencias }) {
  const [estado, onSubmit, pending] = useAccion(accionPreferencias, undefined);
  // Valor efectivo: la preferencia guardada o lo que trae por defecto algún evento de la categoría.
  const marcado = (c: Categoria, canal: "push" | "email") =>
    prefs[c]?.[canal] ?? Object.entries(EVENTOS).some(([tipo, ev]) => ev.categoria === c && canales(tipo as keyof typeof EVENTOS, null).includes(canal));
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <table className="w-full rounded-xl border bg-card text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-3 font-semibold">Categoría</th>
            <th className="p-3 text-center font-semibold">Push</th>
            <th className="p-3 text-center font-semibold">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(Object.entries(CATEGORIAS) as [Categoria, string][]).map(([c, nombre]) => (
            <tr key={c}>
              <td className="p-3">{nombre}</td>
              {(["push", "email"] as const).map((canal) => (
                <td key={canal} className="p-3 text-center">
                  <input type="checkbox" name={`${c}.${canal}`} defaultChecked={marcado(c, canal)} aria-label={`${nombre}: ${canal}`} className="size-5 accent-primary" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Las notificaciones dentro de la app llegan siempre. Las alertas de seguridad van siempre por email.</p>
      {estado?.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Guardar preferencias
      </Button>
    </form>
  );
}

const aBytes = (b64: string) => {
  const p = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

/** Activar push en este dispositivo (requiere el service worker, solo en producción). */
export function ActivarPush({ clave }: { clave: string | null }) {
  const [estado, setEstado] = useState<"cargando" | "no_soportado" | "inactivo" | "activo" | "bloqueado">("cargando");
  const [pending, start] = useTransition();
  useEffect(() => {
    void (async () => {
      if (!clave || !("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado("no_soportado");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const r = await navigator.serviceWorker.getRegistration();
      setEstado(!r ? "no_soportado" : (await r.pushManager.getSubscription()) ? "activo" : "inactivo");
    })();
  }, [clave]);
  if (estado === "cargando") return null;
  if (estado === "no_soportado") return <p className="text-sm text-muted-foreground">Este navegador no admite notificaciones push (en iPhone, instalá la app en la pantalla de inicio).</p>;
  if (estado === "bloqueado") return <p className="text-sm text-muted-foreground">Las notificaciones están bloqueadas para este sitio en el navegador.</p>;
  return (
    <Button
      type="button"
      variant={estado === "activo" ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await navigator.serviceWorker.ready;
          const actual = await r.pushManager.getSubscription();
          if (actual) {
            await accionDesuscribirPush(actual.endpoint);
            await actual.unsubscribe();
            return setEstado("inactivo");
          }
          if ((await Notification.requestPermission()) !== "granted") return setEstado("bloqueado");
          const s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave!) });
          await accionSuscribirPush(JSON.stringify(s.toJSON()), navigator.userAgent);
          setEstado("activo");
        })
      }
    >
      <BellRing data-icon="inline-start" /> {estado === "activo" ? "Desactivar push en este dispositivo" : "Activar push en este dispositivo"}
    </Button>
  );
}
