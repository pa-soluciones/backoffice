import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { estadoIA } from "@/services/ia";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { ConfigIAForm } from "./config-form";

export const metadata: Metadata = { title: "Asistente de IA" };

const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

async function Contenido() {
  const { usuario } = await requirePermiso("configuracion", "leer");
  const [e, permisos] = await Promise.all([estadoIA(), getPermisos(usuario.id)]);
  const pct = e.config.limiteMensualUsd > 0 ? Math.min(100, (e.mes.usd / e.config.limiteMensualUsd) * 100) : 100;
  return (
    <>
      {e.configurada ? (
        <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          Claude está conectado (clave de API cargada en el servidor).
        </p>
      ) : (
        <div role="alert" className="space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Falta la clave de la API de Anthropic.</p>
          <p>
            Creala en console.anthropic.com → API Keys y cargala en Vercel como <code className="font-mono">ANTHROPIC_API_KEY</code>. La suscripción de Claude
            (Pro/Max) no incluye acceso a la API: se paga aparte, por uso.
          </p>
        </div>
      )}
      <section className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Consumo de este mes</h2>
          <span className="text-sm tabular-nums">
            {usd.format(e.mes.usd)} de {usd.format(e.config.limiteMensualUsd)} · {e.mes.llamadas} {e.mes.llamadas === 1 ? "pedido" : "pedidos"}
          </span>
        </div>
        <div role="progressbar" aria-label="Consumo de IA" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={pct >= 100 ? "h-full bg-destructive" : pct >= 75 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">Estimado con los precios publicados de Anthropic. El cargo real lo ves en console.anthropic.com.</p>
      </section>
      <ConfigIAForm config={e.config} editable={!!alcanceDe(permisos, "configuracion", "escribir")} />
    </>
  );
}

export default function IAPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/ajustes", label: "Ajustes" }, { label: "Asistente de IA" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Asistente de IA</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
