import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alcanceDe } from "@/domain/permisos";
import { opcionesRoles } from "@/services/roles";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { obtenerUsuario } from "@/services/usuarios";
import { AccionesCuenta, UsuarioForm } from "../usuario-form";

export const metadata: Metadata = { title: "Usuario" };

async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { usuario: actor } = await requirePermiso("usuarios", "leer");
  const { id } = await params;
  const [u, roles, permisos] = await Promise.all([obtenerUsuario(id), opcionesRoles(), getPermisos(actor.id)]);
  if (!u) notFound();
  const puedeEscribir = !!alcanceDe(permisos, "usuarios", "escribir");

  return (
    <>
      <h1 className="text-2xl font-bold md:text-3xl">{u.name}</h1>
      <UsuarioForm usuario={u} roles={roles} puedeEscribir={puedeEscribir} />
      {puedeEscribir && <AccionesCuenta usuario={u} />}
    </>
  );
}

export default function UsuarioPage({ params }: PageProps<"/ajustes/usuarios/[id]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/ajustes/usuarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> Usuarios
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detalle params={params} />
      </Suspense>
    </div>
  );
}
