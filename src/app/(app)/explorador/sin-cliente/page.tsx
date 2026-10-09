import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import { Migas } from "@/components/migas";
import { listarPresupuestos } from "@/services/presupuestos";

export const metadata: Metadata = { title: "Sin cliente" };

async function Lista() {
  const lista = await listarPresupuestos({ sinCliente: true });
  if (!lista.length) return <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay prospectos sin cliente.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {lista.map((p) => (
        <li key={p.id}>
          <Link href={`/presupuestos/${p.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/60">
            <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-semibold">{p.cliente}</span>
            <EstadoBadge estado={p.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function SinClientePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { label: "Sin cliente" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Prospectos sin cliente</h1>
      <p className="text-sm text-muted-foreground">Consultas de gente que todavía no sabemos de qué empresa es. Al asociarles un cliente pasan a su carpeta.</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </div>
  );
}
