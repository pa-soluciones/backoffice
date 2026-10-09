import { ChevronLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { alcanceDe } from "@/domain/permisos";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { listarUsuarios } from "@/services/usuarios";

export const metadata: Metadata = { title: "Usuarios" };

function Estado({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Activo</span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Inactivo</span>
  );
}

async function Lista() {
  const { usuario } = await requirePermiso("usuarios", "leer");
  const [usuarios, permisos] = await Promise.all([listarUsuarios(), getPermisos(usuario.id)]);
  const puedeCrear = !!alcanceDe(permisos, "usuarios", "escribir");

  return (
    <>
      {puedeCrear && (
        <div className="flex justify-end">
          <Link href="/ajustes/usuarios/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Nuevo usuario
          </Link>
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-card">
        {usuarios.map((u) => (
          <li key={u.id}>
            <Link href={`/ajustes/usuarios/${u.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-muted/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{u.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  @{u.username}
                  {u.email ? ` · ${u.email}` : ""}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{u.roles.join(", ") || "Sin rol"}</span>
              <span className="flex items-center gap-2">
                {u.twoFactorEnabled && (
                  <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info">2FA</span>
                )}
                <Estado activo={u.activo} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function UsuariosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/ajustes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Ajustes
        </Link>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Usuarios</h1>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista />
      </Suspense>
    </div>
  );
}
