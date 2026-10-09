"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORIAS, type Preferencias } from "@/domain/notificaciones";
import { desuscribirPush, guardarPreferencias, marcarLeidas, suscribirPush } from "@/services/notificaciones";

export async function accionMarcarLeidas(ids: string[] | "todas") {
  await marcarLeidas(ids === "todas" ? "todas" : z.array(z.string().uuid()).parse(ids));
  revalidatePath("/", "layout");
}

export async function accionPreferencias(_: unknown, fd: FormData): Promise<{ ok?: string }> {
  const p: Preferencias = {};
  for (const c of Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[]) p[c] = { push: fd.has(`${c}.push`), email: fd.has(`${c}.email`) };
  await guardarPreferencias(p);
  revalidatePath("/notificaciones");
  return { ok: "Preferencias guardadas." };
}

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function accionSuscribirPush(json: string, userAgent: string | null) {
  const s = sub.parse(JSON.parse(json));
  await suscribirPush({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null });
}

export async function accionDesuscribirPush(endpoint: string) {
  await desuscribirPush(endpoint);
}
