"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionSolicitar } from "./actions";

function Formulario({ onOtro }: { onOtro: () => void }) {
  const [estado, onSubmit, pending] = useAccion(accionSolicitar, undefined);
  const [pedido, setPedido] = useState("");

  if (estado?.enviado) {
    return (
      <div className="mt-4 space-y-4">
        <p role="status" className="text-sm">
          Si el usuario existe y tiene un correo cargado, te enviamos un link para elegir una nueva contraseña. Revisá también la carpeta de spam.
        </p>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Pedido para: <strong className="break-all">{pedido}</strong>
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={onOtro}>
          Probar con otro usuario o email
        </Button>
        <p className="text-sm text-muted-foreground">¿Tu usuario no tiene correo? Pedile a un administrador que te genere una clave temporal.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Te enviamos un link a tu correo para elegir una nueva contraseña.</p>
      <form
        onSubmit={(e) => {
          setPedido(String(new FormData(e.currentTarget).get("identificador") ?? "").trim());
          onSubmit(e);
        }}
        className="space-y-4"
      >
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
  );
}

export default function RecuperarPage() {
  // Cambiar la key remonta el formulario vacío para hacer otro pedido.
  const [intento, setIntento] = useState(0);
  return (
    <>
      <h1 className="text-xl font-bold">Recuperar acceso</h1>
      <Formulario key={intento} onOtro={() => setIntento((i) => i + 1)} />
      <Link href="/login" className="mt-4 block text-center text-sm text-primary-text hover:underline">
        Volver a iniciar sesión
      </Link>
    </>
  );
}
