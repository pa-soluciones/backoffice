"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionSolicitar } from "./actions";

export default function RecuperarPage() {
  const [estado, onSubmit, pending] = useAccion(accionSolicitar, undefined);

  return (
    <>
      <h1 className="text-xl font-bold">Recuperar acceso</h1>
      {estado?.enviado ? (
        <div className="mt-4 space-y-4">
          <p role="status" className="text-sm">
            Si el usuario existe y tiene un correo cargado, te enviamos un link para elegir una nueva contraseña. Revisá
            también la carpeta de spam.
          </p>
          <p className="text-sm text-muted-foreground">¿Tu usuario no tiene correo? Pedile a un administrador que te genere una clave temporal.</p>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Te enviamos un link a tu correo para elegir una nueva contraseña.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identificador">Usuario o email</Label>
              <Input id="identificador" name="identificador" autoComplete="username" autoCapitalize="none" required autoFocus />
            </div>
            {estado?.error && (
              <p role="alert" className="text-sm text-destructive">
                {estado.error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        </>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm text-primary-text hover:underline">
        Volver a iniciar sesión
      </Link>
    </>
  );
}
