import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { opcionesRoles } from "@/services/roles";
import { requirePermiso } from "@/services/sesion";
import { UsuarioForm } from "../usuario-form";

export const metadata: Metadata = { title: "Nuevo usuario" };

async function Formulario() {
  await requirePermiso("usuarios", "escribir");
  return <UsuarioForm roles={await opcionesRoles()} puedeEscribir />;
}

export default function NuevoUsuarioPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/ajustes/usuarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Usuarios
        </Link>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Nuevo usuario</h1>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}
