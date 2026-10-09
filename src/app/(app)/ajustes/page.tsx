import { ChevronRight, FileText, ScrollText, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alcanceDe, type Modulo } from "@/domain/permisos";
import { getPermisos, requireUsuario } from "@/services/sesion";

export const metadata: Metadata = { title: "Ajustes" };

const SECCIONES: { href: string; titulo: string; texto: string; modulo: Modulo; icon: typeof Users }[] = [
  { href: "/ajustes/usuarios", titulo: "Usuarios", texto: "Altas, roles, contraseñas y 2FA", modulo: "usuarios", icon: Users },
  { href: "/ajustes/roles", titulo: "Roles y permisos", texto: "Qué puede hacer cada rol en cada módulo", modulo: "roles", icon: ShieldCheck },
  { href: "/ajustes/presupuestos", titulo: "Presupuestos", texto: "Numeración anual y valores por defecto", modulo: "configuracion", icon: FileText },
  { href: "/ajustes/auditoria", titulo: "Auditoría", texto: "Quién hizo qué y cuándo", modulo: "auditoria", icon: ScrollText },
];

async function Secciones() {
  const u = await requireUsuario();
  const permisos = await getPermisos(u.id);
  const visibles = SECCIONES.filter((s) => alcanceDe(permisos, s.modulo, "leer"));

  if (!visibles.length) return <p className="text-muted-foreground">No tenés acceso a ninguna sección de ajustes.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {visibles.map(({ href, titulo, texto, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex items-center gap-4 p-4 hover:bg-muted/60">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">
              <span className="block font-semibold">{titulo}</span>
              <span className="block text-sm text-muted-foreground">{texto}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AjustesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Ajustes</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <Secciones />
      </Suspense>
    </div>
  );
}
