"use client";

import { useEffect } from "react";

const CADA = 15 * 60_000; // spec/12 RNF-03

/** Registra el service worker (solo en producción) y precarga Campo para usarlo sin conexión. */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const precalentar = () => navigator.onLine && navigator.serviceWorker.controller?.postMessage("precalentar");
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(precalentar, () => {});
    navigator.serviceWorker.addEventListener("controllerchange", precalentar);
    window.addEventListener("online", precalentar);
    const t = setInterval(precalentar, CADA);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", precalentar);
      window.removeEventListener("online", precalentar);
      clearInterval(t);
    };
  }, []);
  return null;
}

/** Al cerrar sesión: borra las páginas guardadas (la cola de pendientes se conserva). */
export function olvidarPaginas() {
  navigator.serviceWorker?.controller?.postMessage("olvidar");
}
