import { FileText } from "lucide-react";

const kpis = [
  "Prospectos",
  "En espera",
  "En progreso",
  "Pendiente liquidación",
];

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Inicio</h1>

      <section aria-label="Presupuestos por estado" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((label) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-heading text-3xl font-bold tabular-nums">0</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">Todavía no hay presupuestos</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Acá vas a ver los trabajos de hoy, presupuestos en espera, cobros pendientes y visitas de la semana.
        </p>
      </section>
    </div>
  );
}
