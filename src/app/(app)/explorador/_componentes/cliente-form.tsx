"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/hooks/use-accion";
import { accionGuardarCliente, accionSugerirClientes } from "../actions";

type Cliente = { id: string; razonSocial: string; cuit: string | null; telefono: string | null; email: string | null; notas: string | null };

export function ClienteForm({ cliente }: { cliente?: Cliente }) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarCliente, undefined);
  const [razon, setRazon] = useState(cliente?.razonSocial ?? "");
  const [similares, setSimilares] = useState<{ id: string; razonSocial: string }[]>([]);

  // Aviso de posibles duplicados mientras se tipea (RF-CLI-04).
  useEffect(() => {
    if (razon.trim().length < 3 || razon === cliente?.razonSocial) return;
    const t = setTimeout(async () => setSimilares(await accionSugerirClientes(razon, cliente?.id)), 300);
    return () => clearTimeout(t);
  }, [razon, cliente?.id, cliente?.razonSocial]);
  const mostrarSimilares = razon.trim().length >= 3 && razon !== cliente?.razonSocial && similares.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo label="Razón social" name="razonSocial" value={razon} onChange={(e) => setRazon(e.target.value)} required autoFocus={!cliente} />
          {mostrarSimilares && (
            <div role="status" className="mt-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-semibold">¿Ya existe? Hay clientes parecidos:</p>
              <ul className="mt-1 list-disc pl-5">
                {similares.map((s) => (
                  <li key={s.id}>
                    <Link href={`/explorador/${s.id}`} className="text-primary-text underline">
                      {s.razonSocial}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Campo label="CUIT (opcional)" name="cuit" defaultValue={cliente?.cuit ?? ""} inputMode="numeric" placeholder="30-12345678-9" />
        <Campo label="Teléfono (opcional)" name="telefono" type="tel" defaultValue={cliente?.telefono ?? ""} />
        <Campo label="Email (opcional)" name="email" type="email" defaultValue={cliente?.email ?? ""} className="sm:col-span-2" />
        <AreaTexto label="Notas (opcional)" name="notas" defaultValue={cliente?.notas ?? ""} className="sm:col-span-2" />
      </div>
      <MensajeError error={estado?.error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : cliente ? "Guardar cambios" : "Crear cliente"}
      </Button>
    </form>
  );
}
