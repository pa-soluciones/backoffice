"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cambiarCorreo,
  cambiarPassword,
  confirmar2fa,
  finalizarSiCorresponde,
  guardarRecuperacion,
  iniciar2fa,
  reenviarCodigo,
  verificarCodigoEmail,
} from "@/services/configuracion-inicial";
import { requireSesion } from "@/services/sesion";

export type Estado = { error?: string; enviado?: boolean } | undefined;

const primerError = (r: z.ZodSafeParseError<unknown>) => r.error.issues[0]?.message ?? "Datos inválidos.";

export async function accionPassword(_: Estado, fd: FormData): Promise<Estado> {
  const u = await requireSesion();
  const r = z
    .object({
      actual: z.string().min(1, "Ingresá la contraseña actual."),
      nueva: z.string().min(10, "La nueva contraseña debe tener al menos 10 caracteres."),
      confirmar: z.string(),
    })
    .refine((d) => d.nueva === d.confirmar, "Las contraseñas no coinciden.")
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  const res = await cambiarPassword(u, r.data.actual, r.data.nueva);
  if (res.error) return res;
  redirect("/configuracion-inicial");
}

export async function accionRecuperacion(_: Estado, fd: FormData): Promise<Estado> {
  const u = await requireSesion();
  const r = z
    .object({
      frase: z
        .string()
        .trim()
        .min(20, "La frase debe tener al menos 20 caracteres.")
        .refine((f) => f.split(/\s+/).length >= 4, "La frase debe tener al menos 4 palabras."),
      confirmarFrase: z.string().trim(),
      email: z.email("Ingresá un email válido."),
    })
    .refine((d) => d.frase === d.confirmarFrase, "Las frases no coinciden.")
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: primerError(r) };
  try {
    await guardarRecuperacion(u, r.data.frase, r.data.email);
  } catch {
    return { error: "No se pudo enviar el email. Revisá la configuración de Resend (RESEND_API_KEY)." };
  }
  redirect("/configuracion-inicial");
}

export async function accionVerificarEmail(_: Estado, fd: FormData): Promise<Estado> {
  const u = await requireSesion();
  const res = await verificarCodigoEmail(u, String(fd.get("codigo") ?? ""));
  if (res.error) return res;
  await finalizarSiCorresponde(u);
  redirect("/configuracion-inicial");
}

export async function accionReenviar(): Promise<Estado> {
  const u = await requireSesion();
  try {
    await reenviarCodigo(u);
  } catch {
    return { error: "No se pudo enviar el email." };
  }
  return { enviado: true };
}

export async function accionCambiarCorreo() {
  const u = await requireSesion();
  await cambiarCorreo(u);
  redirect("/configuracion-inicial");
}

export type Estado2fa = { error?: string; qr?: string; secreto?: string; backupCodes?: string[] } | undefined;

export async function accionIniciar2fa(_: Estado2fa, fd: FormData): Promise<Estado2fa> {
  await requireSesion();
  return iniciar2fa(String(fd.get("password") ?? ""));
}

export async function accionConfirmar2fa(_: Estado, fd: FormData): Promise<Estado> {
  const u = await requireSesion();
  const res = await confirmar2fa(u, String(fd.get("code") ?? ""));
  if (res.error) return res;
  redirect("/configuracion-inicial");
}
