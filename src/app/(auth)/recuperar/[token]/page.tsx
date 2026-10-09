import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { estadoToken } from "@/services/recuperacion";
import { RestablecerForm } from "./restablecer-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

async function Contenido({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const estado = await estadoToken(token);
  if (!estado) {
    return (
      <>
        <h1 className="text-xl font-bold">Link vencido</h1>
        <p className="mt-2 text-sm text-muted-foreground">El link venció o ya se usó.</p>
        <Link href="/recuperar" className="mt-4 block text-center text-sm text-primary-text hover:underline">
          Pedir un link nuevo
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-bold">Nueva contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Al guardarla se cierran todas tus sesiones abiertas.</p>
      <RestablecerForm token={token} pideFrase={estado.pideFrase} />
    </>
  );
}

export default function RestablecerPage({ params }: PageProps<"/recuperar/[token]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
