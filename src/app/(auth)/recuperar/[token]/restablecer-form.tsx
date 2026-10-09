"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionRestablecer } from "../actions";

export function RestablecerForm({ token, pideFrase }: { token: string; pideFrase: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionRestablecer, undefined);

  if (estado?.listo) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm">Listo, tu contraseña se actualizó.</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {pideFrase && (
        <div className="space-y-1.5">
          <Label htmlFor="frase">Frase de recuperación</Label>
          <Input id="frase" name="frase" autoComplete="off" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="nueva">Nueva contraseña</Label>
        <Input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmar">Repetir nueva contraseña</Label>
        <Input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required />
      </div>
      {pideFrase && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="perdi2fa" className="mt-0.5 size-4 accent-primary" />
          También perdí el acceso a mi app de autenticación (vas a configurar el 2FA de nuevo al entrar)
        </label>
      )}
      {estado?.error && (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
