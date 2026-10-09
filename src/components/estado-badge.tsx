import { Percent } from "lucide-react";
import { ESTADOS_ADICIONAL, type EstadoAdicional } from "@/domain/adicionales";
import { ESTADOS, type Estado } from "@/domain/workflow";
import { cn } from "@/lib/utils";

// Colores de spec/02 §3. Siempre texto + color (nunca solo color).
const ESTILO: Record<Estado, string> = {
  prospecto: "bg-muted text-foreground",
  visita_tecnica: "bg-info/15 text-info",
  en_espera: "bg-warning/15 text-warning",
  en_progreso: "bg-primary/20 text-primary-text",
  pendiente_liquidacion: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  terminado: "bg-success/15 text-success",
  rechazado: "bg-rose-800/15 text-rose-800 dark:text-rose-300",
  cancelado: "bg-muted text-muted-foreground line-through",
};

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", ESTILO[estado], className)}>
      {ESTADOS[estado]}
    </span>
  );
}

export function BonificadoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-text">
      <Percent className="size-3" aria-hidden />
      Bonificado
    </span>
  );
}

const ESTILO_ADICIONAL: Record<EstadoAdicional, string> = {
  borrador: "bg-muted text-foreground",
  enviado: "bg-warning/15 text-warning",
  aprobado: "bg-success/15 text-success",
  rechazado: "bg-rose-800/15 text-rose-800 dark:text-rose-300",
  cancelado: "bg-muted text-muted-foreground line-through",
};

export function EstadoAdicionalBadge({ estado }: { estado: EstadoAdicional }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", ESTILO_ADICIONAL[estado])}>
      {ESTADOS_ADICIONAL[estado]}
    </span>
  );
}
