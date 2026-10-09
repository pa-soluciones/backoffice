"use server";

import { z } from "zod";
import { restablecer, solicitarRecuperacion } from "@/services/recuperacion";

export type Estado = { error?: string; enviado?: boolean; listo?: boolean } | undefined;

export async function accionSolicitar(_: Estado, fd: FormData): Promise<Estado> {
  const identificador = String(fd.get("identificador") ?? "").trim();
  if (!identificador) return { error: "Ingresá tu usuario o email." };
  try {
    await solicitarRecuperacion(identificador);
  } catch {
    // Mismo mensaje pase lo que pase: no revela si el usuario existe.
  }
  return { enviado: true };
}

export async function accionRestablecer(_: Estado, fd: FormData): Promise<Estado> {
  const r = z
    .object({
      token: z.string().min(20),
      nueva: z.string().min(10, "La nueva contraseña debe tener al menos 10 caracteres."),
      confirmar: z.string(),
      frase: z.string().optional(),
      perdi2fa: z.literal("on").optional(),
    })
    .refine((d) => d.nueva === d.confirmar, "Las contraseñas no coinciden.")
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message };
  const res = await restablecer(r.data.token, r.data.nueva, r.data.frase ?? null, !!r.data.perdi2fa);
  return res.error ? { error: res.error } : { listo: true };
}
