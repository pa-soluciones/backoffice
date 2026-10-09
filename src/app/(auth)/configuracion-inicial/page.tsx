import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { pasoActual, type Paso } from "@/services/configuracion-inicial";
import { requireSesion } from "@/services/sesion";
import { Paso2fa, PasoPassword, PasoRecuperacion, PasoVerificarEmail } from "./pasos";

export const metadata: Metadata = { title: "Configuración inicial" };

const TITULOS: Record<Exclude<Paso, "listo">, [string, string]> = {
  password: ["Nueva contraseña", "Elegí una contraseña propia para reemplazar la temporal."],
  recuperacion: [
    "Datos de recuperación",
    "Si algún día perdés el acceso, vas a necesitar esta frase y este correo. Guardá la frase en un lugar seguro: no se vuelve a mostrar.",
  ],
  "verificar-email": ["Verificá tu correo", "Te enviamos un código de 6 dígitos al correo de recuperación."],
  "2fa": [
    "Verificación en dos pasos",
    "Instalá Google Authenticator, Microsoft Authenticator o similar en tu celular y escaneá el código.",
  ],
};

async function Contenido() {
  const u = await requireSesion();
  const paso = await pasoActual(u);
  if (paso === "listo") redirect("/");

  // Barra de progreso solo para el asistente completo del admin.
  const pasos: Paso[] = u.mustCompleteSetup
    ? ["password", "recuperacion", "verificar-email", "2fa"]
    : (["password", "2fa"] as Paso[]).filter((p) => p === paso || (p === "2fa" && !u.twoFactorEnabled));
  const n = pasos.indexOf(paso);
  const [titulo, ayuda] = TITULOS[paso];

  return (
    <>
      {pasos.length > 1 && (
        <ol aria-label="Progreso" className="mb-6 flex gap-1.5">
          {pasos.map((p, i) => (
            <li key={p} className={`h-1.5 flex-1 rounded-full ${i <= n ? "bg-primary" : "bg-muted"}`}>
              <span className="sr-only">
                Paso {i + 1} de {pasos.length}
                {i === n ? " (actual)" : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{ayuda}</p>
      {paso === "password" && <PasoPassword />}
      {paso === "recuperacion" && <PasoRecuperacion />}
      {paso === "verificar-email" && <PasoVerificarEmail />}
      {paso === "2fa" && <Paso2fa />}
    </>
  );
}

export default function ConfiguracionInicialPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
