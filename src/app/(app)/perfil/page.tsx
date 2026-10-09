import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alcanceDe } from "@/domain/permisos";
import { misTokens } from "@/services/mcp";
import { getPermisos, requireUsuario } from "@/services/sesion";
import { TokensMcp } from "./tokens";

export const metadata: Metadata = { title: "Mi perfil" };

async function Contenido() {
  const u = await requireUsuario();
  const puedeMcp = !!alcanceDe(await getPermisos(u.id), "mcp", "escribir");
  const tokens = puedeMcp ? await misTokens() : [];
  const url = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/mcp`;
  return (
    <>
      <section className="space-y-1 rounded-xl border bg-card p-4 text-sm">
        <p className="text-lg font-semibold">{u.name}</p>
        <p className="text-muted-foreground">{u.email.endsWith(".invalid") ? "Sin email" : u.email}</p>
        <Link href="/notificaciones" className="inline-block pt-2 font-semibold text-primary-text underline-offset-4 hover:underline">
          Notificaciones y avisos
        </Link>
      </section>
      {puedeMcp && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Integraciones MCP</h2>
          <p className="text-sm text-muted-foreground">
            Un token permite que Claude (u otro asistente compatible con MCP) consulte y opere PAS Backoffice en tu nombre, con tus mismos permisos, sin poder eliminar nada. Cada acción queda en la auditoría con el nombre del token.
          </p>
          <TokensMcp tokens={tokens} url={url} />
        </section>
      )}
    </>
  );
}

export default function PerfilPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Mi perfil</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
