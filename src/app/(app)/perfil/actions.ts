"use server";

import { revalidatePath } from "next/cache";
import { ErrorNegocio } from "@/services/errores";
import { crearToken, revocarToken } from "@/services/mcp";

export async function accionCrearToken(_: unknown, fd: FormData): Promise<{ error?: string; token?: string }> {
  try {
    const token = await crearToken(String(fd.get("nombre") ?? ""), Number(fd.get("dias")));
    revalidatePath("/perfil");
    return { token };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { error: e.message };
    throw e;
  }
}

export async function accionRevocarToken(id: string) {
  await revocarToken(id);
  revalidatePath("/perfil");
}
