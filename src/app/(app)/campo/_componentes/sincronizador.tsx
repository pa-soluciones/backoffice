"use client";

import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { descartar, guardar, listar, sincronizar, type Envio, type Pendiente } from "@/lib/cola";
import { accionConfirmarFoto, accionPrepararFoto, accionRegistrar } from "../actions";

const envio: Envio = { registrar: accionRegistrar, prepararFoto: accionPrepararFoto, confirmarFoto: accionConfirmarFoto };
const INTERVALO = 30_000;

/** Indicador permanente de la cola (spec/12 RNF-05) y disparador de la sincronización. */
export function Sincronizador() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [online, setOnline] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    const refrescar = () => listar().then(setPendientes, () => setPendientes([]));
    const correr = () => void sincronizar(envio);
    const conexion = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) correr();
    };
    const inicio = () => setSincronizando(true);
    const fin = () => {
      setSincronizando(false);
      void refrescar();
    };
    conexion();
    void refrescar();
    window.addEventListener("online", conexion);
    window.addEventListener("offline", conexion);
    window.addEventListener("pas-cola-inicio", inicio);
    window.addEventListener("pas-cola", fin);
    window.addEventListener("pas-cola-nuevo", correr);
    const t = setInterval(correr, INTERVALO);
    return () => {
      window.removeEventListener("online", conexion);
      window.removeEventListener("offline", conexion);
      window.removeEventListener("pas-cola-inicio", inicio);
      window.removeEventListener("pas-cola", fin);
      window.removeEventListener("pas-cola-nuevo", correr);
      clearInterval(t);
    };
  }, []);

  const conError = pendientes.filter((p) => p.error);
  const enCola = pendientes.length - conError.length;
  const texto = !online
    ? `Sin conexión · ${enCola} ${enCola === 1 ? "pendiente" : "pendientes"}`
    : sincronizando
      ? "Sincronizando…"
      : enCola
        ? `${enCola} ${enCola === 1 ? "pendiente" : "pendientes"} de enviar`
        : "Todo sincronizado";

  return (
    <div className="space-y-2">
      <p role="status" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${online ? "bg-muted" : "bg-sidebar text-sidebar-foreground"}`}>
        {online ? <RefreshCw className={`size-4 ${sincronizando ? "animate-spin" : ""}`} aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
        {texto}
      </p>
      {conError.length > 0 && (
        <section aria-label="Pendientes con error" className="space-y-2 rounded-xl border border-destructive/40 bg-card p-3">
          <h2 className="text-sm font-semibold">Pendientes con error</h2>
          <ul className="space-y-2 text-sm">
            {conError.map((p) => (
              <li key={p.clientId} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.etiqueta}</span>
                  <span className="block text-destructive">{p.error}</span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => guardar({ ...p, error: undefined }).then(() => sincronizar(envio))}>
                  Reintentar
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Descartar ${p.etiqueta}`} onClick={() => confirm("¿Descartar este registro? No se va a guardar.") && descartar(p.clientId)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
