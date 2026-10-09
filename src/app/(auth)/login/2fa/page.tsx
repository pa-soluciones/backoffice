"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, mensajeError } from "@/lib/auth-client";

export default function DosFactoresPage() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code")).replace(/\s/g, "");
    const trustDevice = fd.get("confiar") === "on";

    const { error } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });

    if (error) {
      setError(mensajeError(error));
      setPending(false);
      return;
    }
    router.replace("/");
  }

  return (
    <>
      <h1 className="text-xl font-bold">Verificación en dos pasos</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {backup
          ? "Ingresá uno de tus códigos de respaldo."
          : "Ingresá el código de 6 dígitos de tu app de autenticación."}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">{backup ? "Código de respaldo" : "Código"}</Label>
          <Input
            id="code"
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode={backup ? "text" : "numeric"}
            pattern={backup ? undefined : "[0-9 ]{6,7}"}
            className="text-center font-heading text-lg tracking-[0.3em]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confiar" className="size-4 accent-primary" />
          Confiar en este dispositivo por 30 días
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Verificando…" : "Verificar"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setBackup(!backup);
            setError("");
          }}
          className="block w-full text-center text-sm text-primary-text hover:underline"
        >
          {backup ? "Usar código de la app" : "Usar un código de respaldo"}
        </button>
      </form>
    </>
  );
}
