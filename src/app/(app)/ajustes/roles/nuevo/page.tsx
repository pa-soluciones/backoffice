import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePermiso } from "@/services/sesion";
import { RolForm } from "../rol-form";

export const metadata: Metadata = { title: "Nuevo rol" };

async function Formulario() {
  await requirePermiso("roles", "escribir");
  return <RolForm puedeEscribir />;
}

export default function NuevoRolPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/ajustes/roles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Roles
        </Link>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Nuevo rol</h1>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}
