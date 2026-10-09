"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accionCambiarCorreo,
  accionConfirmar2fa,
  accionIniciar2fa,
  accionPassword,
  accionRecuperacion,
  accionReenviar,
  accionVerificarEmail,
} from "./actions";

// React resetea los campos tras un `action` de formulario; con onSubmit los valores quedan
// cargados si el servidor devuelve un error.
function useAccion<S>(fn: (s: Awaited<S>, fd: FormData) => Promise<S>, inicial: Awaited<S>) {
  const [estado, accion, pending] = useActionState<S, FormData>(fn, inicial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => accion(fd));
  };
  return [estado, onSubmit, pending] as const;
}

function Campo({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} required {...props} />
    </div>
  );
}

function Error({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="text-sm text-destructive">
      {msg}
    </p>
  ) : null;
}

function Enviar({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Procesando…" : children}
    </Button>
  );
}

export function PasoPassword() {
  const [s, action, pending] = useAccion(accionPassword, undefined);
  return (
    <form onSubmit={action} className="space-y-4">
      <Campo label="Contraseña actual" name="actual" type="password" autoComplete="current-password" />
      <Campo label="Nueva contraseña" name="nueva" type="password" autoComplete="new-password" minLength={10} />
      <Campo label="Repetir nueva contraseña" name="confirmar" type="password" autoComplete="new-password" />
      <p className="text-xs text-muted-foreground">Mínimo 10 caracteres. Mejor una frase larga que una palabra rara.</p>
      <Error msg={s?.error} />
      <Enviar pending={pending}>Continuar</Enviar>
    </form>
  );
}

export function PasoRecuperacion() {
  const [s, action, pending] = useAccion(accionRecuperacion, undefined);
  return (
    <form onSubmit={action} className="space-y-4">
      <Campo label="Frase de recuperación" name="frase" autoComplete="off" placeholder="ej.: corona naranja perfora losa los martes" />
      <Campo label="Repetir frase" name="confirmarFrase" autoComplete="off" />
      <Campo label="Correo de recuperación" name="email" type="email" autoComplete="email" />
      <Error msg={s?.error} />
      <Enviar pending={pending}>Enviar código</Enviar>
    </form>
  );
}

export function PasoVerificarEmail({ email }: { email: string }) {
  const [s, action, pending] = useAccion(accionVerificarEmail, undefined);
  const [r, reenviar, reenviando] = useActionState(accionReenviar, undefined);
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        Enviado a <strong className="break-all">{email}</strong>
      </p>
      <form onSubmit={action} className="space-y-4">
        <Campo
          label="Código"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          className="text-center font-heading text-lg tracking-[0.3em]"
        />
        <Error msg={s?.error ?? r?.error} />
        {r?.enviado && !s?.error && (
          <p role="status" className="text-sm text-success">
            Código reenviado. Revisá también la carpeta de spam.
          </p>
        )}
        <Enviar pending={pending}>Verificar</Enviar>
      </form>
      <form action={reenviar}>
        <button type="submit" disabled={reenviando} className="w-full text-center text-sm text-primary-text hover:underline">
          {reenviando ? "Enviando…" : "Reenviar código"}
        </button>
      </form>
      <form action={accionCambiarCorreo}>
        <button type="submit" className="w-full text-center text-sm text-muted-foreground hover:underline">
          ¿El correo está mal? Cambiar correo
        </button>
      </form>
    </div>
  );
}

export function Paso2fa() {
  const [setup, iniciar, iniciando] = useAccion(accionIniciar2fa, undefined);
  const [s, confirmar, confirmando] = useAccion(accionConfirmar2fa, undefined);

  if (!setup?.qr) {
    return (
      <form onSubmit={iniciar} className="space-y-4">
        <Campo label="Confirmá tu contraseña" name="password" type="password" autoComplete="current-password" />
        <Error msg={setup?.error} />
        <Enviar pending={iniciando}>Generar código QR</Enviar>
      </form>
    );
  }

  const descargar = () => {
    const txt = `PAS Backoffice · códigos de respaldo\nCada código sirve una sola vez.\n\n${setup.backupCodes?.join("\n")}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "pas-codigos-respaldo.txt";
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL generada en el servidor */}
      <img src={setup.qr} alt="Código QR para la app de autenticación" width={220} height={220} className="mx-auto rounded-lg border" />
      <p className="text-center text-xs text-muted-foreground">
        ¿No podés escanear? Clave manual:
        <code className="mt-1 block font-mono text-sm break-all text-foreground">{setup.secreto}</code>
      </p>

      <div className="rounded-lg border bg-muted p-3">
        <p className="text-sm font-semibold">Códigos de respaldo</p>
        <p className="mb-2 text-xs text-muted-foreground">Sirven si perdés el celular. Guardalos ahora: no se vuelven a mostrar.</p>
        <ul aria-label="Códigos de respaldo" className="grid grid-cols-2 gap-1 font-mono text-sm">
          {setup.backupCodes?.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={descargar} className="mt-3 w-full">
          Descargar códigos
        </Button>
      </div>

      <form onSubmit={confirmar} className="space-y-4">
        <Campo
          label="Código de la app"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          className="text-center font-heading text-lg tracking-[0.3em]"
        />
        <Error msg={s?.error} />
        <Enviar pending={confirmando}>Activar y terminar</Enviar>
      </form>
    </div>
  );
}
