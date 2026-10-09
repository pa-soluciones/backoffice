"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PermisosEditor } from "@/components/permisos-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Permiso } from "@/domain/permisos";
import { useAccion } from "@/hooks/use-accion";
import {
  accionCambiarActivo,
  accionGuardarUsuario,
  accionReset2fa,
  accionResetPassword,
  type Estado,
} from "../actions";

type Usuario = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  twoFactorEnabled: boolean | null;
  roleIds: string[];
  permisos: Permiso[];
};

type Rol = { id: string; nombre: string; esSistema: boolean };

function Mensaje({ estado }: { estado: Estado }) {
  if (estado?.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {estado.error}
      </p>
    );
  if (estado?.ok && !estado.temporal)
    return (
      <p role="status" className="text-sm text-success">
        Cambios guardados.
      </p>
    );
  return null;
}

/** Contraseña temporal: se muestra una sola vez. */
function Temporal({ valor, children }: { valor: string; children?: React.ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div role="status" className="space-y-3 rounded-xl border border-primary bg-accent p-4">
      <p className="font-semibold">Contraseña temporal</p>
      <p className="text-sm">Pasásela a la persona por un canal seguro. Se le pedirá cambiarla al entrar. No se vuelve a mostrar.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border bg-card px-3 py-2 font-mono text-base break-all">{valor}</code>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiada" : "Copiar"}
        </Button>
      </div>
      {children}
    </div>
  );
}

export function UsuarioForm({ usuario, roles, puedeEscribir }: { usuario?: Usuario; roles: Rol[]; puedeEscribir: boolean }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarUsuario, undefined);

  if (!usuario && estado?.temporal) {
    return (
      <Temporal valor={estado.temporal}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/ajustes/usuarios/${estado.id}`} className={buttonVariants({ variant: "outline" })}>
            Ver usuario
          </Link>
          <Link href="/ajustes/usuarios" className={buttonVariants({ variant: "ghost" })}>
            Volver a la lista
          </Link>
        </div>
      </Temporal>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {usuario && <input type="hidden" name="id" value={usuario.id} />}
      <fieldset disabled={!puedeEscribir} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <legend className="sr-only">Datos</legend>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre y apellido</Label>
          <Input id="name" name="name" defaultValue={usuario?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Usuario</Label>
          <Input id="username" name="username" defaultValue={usuario?.username ?? ""} autoCapitalize="none" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input id="telefono" name="telefono" type="tel" defaultValue={usuario?.telefono ?? ""} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="email">Email (opcional)</Label>
          <Input id="email" name="email" type="email" defaultValue={usuario?.email ?? ""} />
          <p className="text-xs text-muted-foreground">Sin email no recibe notificaciones ni puede recuperar la contraseña solo.</p>
        </div>
      </fieldset>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Roles</h2>
        <fieldset disabled={!puedeEscribir} className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border bg-card p-4">
          <legend className="sr-only">Roles</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex min-h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="roleIds"
                value={r.id}
                defaultChecked={usuario?.roleIds.includes(r.id)}
                className="size-4 accent-primary"
              />
              {r.nombre}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Permisos adicionales</h2>
        <p className="text-sm text-muted-foreground">Se suman a los de sus roles. Usalos para excepciones puntuales.</p>
        <PermisosEditor name="permisos" inicial={usuario?.permisos ?? []} disabled={!puedeEscribir} />
      </section>

      <Mensaje estado={estado} />
      {puedeEscribir && (
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
        </Button>
      )}
    </form>
  );
}

export function AccionesCuenta({ usuario }: { usuario: Usuario }) {
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  const ejecutar = (confirmacion: string, fn: () => Promise<Estado>) => {
    if (!confirm(confirmacion)) return;
    start(async () => setEstado(await fn()));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Cuenta</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            ejecutar(`¿Generar una contraseña temporal para ${usuario.name}? Se cerrarán sus sesiones.`, () =>
              accionResetPassword(usuario.id),
            )
          }
        >
          Resetear contraseña
        </Button>
        {usuario.twoFactorEnabled && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              ejecutar(`¿Quitar el 2FA de ${usuario.name}? Tendrá que configurarlo de nuevo si su rol lo exige.`, () =>
                accionReset2fa(usuario.id),
              )
            }
          >
            Resetear 2FA
          </Button>
        )}
        <Button
          type="button"
          variant={usuario.activo ? "destructive" : "outline"}
          disabled={pending}
          onClick={() =>
            ejecutar(
              usuario.activo
                ? `¿Desactivar a ${usuario.name}? No va a poder entrar y se cierran sus sesiones.`
                : `¿Reactivar a ${usuario.name}?`,
              () => accionCambiarActivo(usuario.id, !usuario.activo),
            )
          }
        >
          {usuario.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </div>
      {estado?.temporal ? <Temporal valor={estado.temporal} /> : <Mensaje estado={estado} />}
    </section>
  );
}
