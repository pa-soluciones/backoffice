import { ChevronLeft, Lock, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { listarRoles } from "@/services/roles";
import { getPermisos, requirePermiso } from "@/services/sesion";

export const metadata: Metadata = { title: "Roles" };

async function Lista() {
  const { usuario } = await requirePermiso("roles", "leer");
  const [roles, permisos] = await Promise.all([listarRoles(), getPermisos(usuario.id)]);

  return (
    <>
      {alcanceDe(permisos, "roles", "escribir") && (
        <div className="flex justify-end">
          <Link href="/ajustes/roles/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Nuevo rol
          </Link>
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-card">
        {roles.map((r) => (
          <li key={r.id}>
            <Link href={`/ajustes/roles/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-muted/60">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {r.nombre}
                  {r.esSistema && <Lock className="size-3.5 text-muted-foreground" aria-label="Rol de sistema" />}
                </span>
                {r.descripcion && <span className="block truncate text-sm text-muted-foreground">{r.descripcion}</span>}
              </span>
              {r.requiere2fa && (
                <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info">2FA obligatorio</span>
              )}
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {r.usuarios} {r.usuarios === 1 ? "usuario" : "usuarios"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function RolesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/ajustes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Ajustes
        </Link>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Roles y permisos</h1>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </div>
  );
}
