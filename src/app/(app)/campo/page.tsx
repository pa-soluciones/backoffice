import { ChevronRight, HardHat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import type { Estado } from "@/domain/workflow";
import { presupuestosParaCampo } from "@/services/campo";

export const metadata: Metadata = { title: "Campo" };

async function Lista() {
  const ps = await presupuestosParaCampo();
  if (ps.length === 0)
    return (
      <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        <HardHat className="mx-auto mb-2 size-6" aria-hidden />
        No tenés presupuestos en curso para registrar trabajos.
      </p>
    );
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {ps.map((p) => (
        <li key={p.id}>
          <Link href={`/campo/${p.id}`} className="flex min-h-14 items-center gap-3 p-3 hover:bg-muted">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.codigo ?? "Sin numerar"}</span>
              <span className="block truncate text-sm text-muted-foreground">{[p.cliente, p.direccion].filter(Boolean).join(" · ")}</span>
            </span>
            <EstadoBadge estado={p.estado as Estado} />
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CampoPage() {
  return (
    <>
      <h1 className="text-2xl font-bold md:text-3xl">Campo</h1>
      <p className="text-sm text-muted-foreground">Elegí la obra para registrar perforaciones. Funciona sin conexión: lo cargado se envía solo al volver la señal.</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </>
  );
}
