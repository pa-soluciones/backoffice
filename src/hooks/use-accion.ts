"use client";

import { startTransition, useActionState } from "react";

/**
 * Como useActionState, pero se dispara con onSubmit: React resetea los campos tras un
 * `action` de formulario, y así los valores quedan cargados si el servidor devuelve un error.
 */
export function useAccion<S>(fn: (s: Awaited<S>, fd: FormData) => Promise<S>, inicial: Awaited<S>) {
  const [estado, accion, pending] = useActionState<S, FormData>(fn, inicial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => accion(fd));
  };
  return [estado, onSubmit, pending] as const;
}
