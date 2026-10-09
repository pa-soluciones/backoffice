import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { formatearBytes, MARGEN, NOMBRE, type Recurso } from "@/domain/cuota-r2";
import { cn } from "@/lib/utils";
import { estadoCuota } from "@/services/cuota-r2";
import { esAdmin, requirePermiso } from "@/services/sesion";
import { AprobarExcedente } from "./aprobar-form";

export const metadata: Metadata = { title: "Almacenamiento" };

const num = new Intl.NumberFormat("es-AR");
const fmt = (r: Recurso, v: number) => (r === "almacenamiento" ? formatearBytes(v) : num.format(v));
const mesLargo = (mes: string) => {
  const t = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-01T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

async function Contenido() {
  const { usuario } = await requirePermiso("configuracion", "leer");
  const [c, admin] = await Promise.all([estadoCuota(), esAdmin(usuario.id)]);
  const recursos = Object.keys(NOMBRE) as Recurso[];
  const bloqueado = recursos.some((r) => c.usado[r] >= c.limite[r]);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Cloudflare no permite poner un tope de gasto, así que la app frena sola al {Math.round(MARGEN * 100)}% del plan gratuito. Si se llega al límite, subir o
        descargar archivos queda bloqueado hasta que un administrador lo apruebe o empiece el mes siguiente. Período: {mesLargo(c.mes)} (UTC).
      </p>

      <ul className="space-y-3">
        {recursos.map((r) => {
          const pct = Math.min(100, (c.usado[r] / c.limite[r]) * 100);
          return (
            <li key={r} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{NOMBRE[r]}</span>
                <span className="text-sm tabular-nums">
                  {fmt(r, c.usado[r])} de {fmt(r, c.limite[r])}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={NOMBRE[r]}
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Plan gratuito: {fmt(r, c.freeTier[r])} por mes.</p>
            </li>
          );
        })}
      </ul>

      {bloqueado && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          Se alcanzó un límite: la carga y descarga de archivos está bloqueada.
        </p>
      )}
      {c.costoEstimado > 0 && <p className="text-sm">Costo estimado del mes por encima del plan gratuito: USD {c.costoEstimado.toFixed(2)}.</p>}
      {c.aprobadoAt && <p className="text-sm text-muted-foreground">Este mes un administrador amplió los límites.</p>}
      {admin && <AprobarExcedente />}
    </>
  );
}

export default function AlmacenamientoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Migas items={[{ href: "/ajustes", label: "Ajustes" }, { label: "Almacenamiento" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Almacenamiento</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
