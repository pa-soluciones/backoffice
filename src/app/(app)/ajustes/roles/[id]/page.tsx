import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alcanceDe } from "@/domain/permisos";
import { obtenerRol } from "@/services/roles";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { RolForm } from "../rol-form";

export const metadata: Metadata = { title: "Rol" };

async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requirePermiso("roles", "leer");
  const { id } = await params;
  const [rol, permisos] = await Promise.all([obtenerRol(id), getPermisos(usuario.id)]);
  if (!rol) notFound();

  return (
    <>
      <h1 className="text-2xl font-bold md:text-3xl">{rol.nombre}</h1>
      <RolForm
        rol={rol}
        puedeEscribir={!!alcanceDe(permisos, "roles", "escribir")}
        puedeEliminar={!!alcanceDe(permisos, "roles", "eliminar")}
      />
    </>
  );
}

export default function RolPage({ params }: PageProps<"/ajustes/roles/[id]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/ajustes/roles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> Roles
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detalle params={params} />
      </Suspense>
    </div>
  );
}
