"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, mensajeError } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const usuario = String(fd.get("usuario")).trim();
    const password = String(fd.get("password"));
    const rememberMe = fd.get("recordar") === "on";

    const { data, error } = usuario.includes("@")
      ? await authClient.signIn.email({ email: usuario, password, rememberMe })
      : await authClient.signIn.username({ username: usuario, password, rememberMe });

    if (error) {
      setError(mensajeError(error));
      setPending(false);
      return;
    }
    // Con 2FA, el plugin redirige a /login/2fa.
    if (data && !("twoFactorRedirect" in data && data.twoFactorRedirect)) router.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="usuario">Usuario o email</Label>
        <Input id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="recordar" className="size-4 accent-primary" />
        Recordarme en este dispositivo
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <Link href="/recuperar" className="block text-center text-sm text-primary-text hover:underline">
        Olvidé mi contraseña
      </Link>
    </form>
  );
}
