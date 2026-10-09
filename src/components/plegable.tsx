"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

/**
 * Formulario secundario plegado detrás de un botón ("Nuevo cobro", "Nuevo gasto"…). Usa <details>
 * nativo (teclado y lectores de pantalla); `abierto` es solo el estado inicial: guardar no lo cierra
 * de golpe y el mensaje de resultado queda a la vista.
 */
export function Plegable({ titulo, children, abierto = false, className }: { titulo: string; children: React.ReactNode; abierto?: boolean; className?: string }) {
  const [open, setOpen] = useState(abierto);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={cn("group", className)}>
      <summary className={cn(buttonVariants({ variant: "outline" }), "w-fit cursor-pointer list-none group-open:mb-3 group-open:bg-muted [&::-webkit-details-marker]:hidden")}>
        <Plus data-icon="inline-start" className="transition-transform group-open:rotate-45" aria-hidden /> {titulo}
      </summary>
      {children}
    </details>
  );
}
