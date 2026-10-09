"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MensajeError } from "@/components/form";

/** Botón que pide confirmación y ejecuta una server action (archivar, eliminar…). */
export function BotonConfirmar({
  accion,
  confirmacion,
  children,
  variant = "outline",
}: {
  accion: () => Promise<{ error?: string } | undefined>;
  confirmacion: string;
  children: React.ReactNode;
  variant?: "outline" | "destructive";
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmacion)) return;
          start(async () => setError((await accion())?.error));
        }}
      >
        {children}
      </Button>
      <MensajeError error={error} />
    </div>
  );
}
