import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { asegurarAdminInicial } from "@/services/bootstrap";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

// Crea el admin inicial la primera vez que alguien abre el login (spec/03 RF-AUTH-01).
async function Bootstrap() {
  await connection();
  await asegurarAdminInicial();
  return null;
}

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <Bootstrap />
      </Suspense>
      <h1 className="text-xl font-bold">Iniciar sesión</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">PAS Backoffice</p>
      <LoginForm />
    </>
  );
}
