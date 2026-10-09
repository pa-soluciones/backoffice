"use client";

import { useState } from "react";
import { AreaTexto, Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionGuardarProspecto } from "../actions";

type Cliente = { id: string; razonSocial: string; obras: { id: string; direccion: string }[] };
type Usuario = { id: string; name: string };
type Prospecto = {
  id: string;
  clienteId: string | null;
  obraId: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
  origen: string | null;
  pedido: string | null;
  requiereVisita: boolean;
  asignados: string[];
};

const ORIGENES = ["WhatsApp", "Teléfono", "Email", "Web", "Referido", "Otro"];
const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm";

export function ProspectoForm({
  clientes,
  usuarios,
  prospecto,
  inicial,
}: {
  clientes: Cliente[];
  usuarios: Usuario[];
  prospecto?: Prospecto;
  inicial?: { clienteId?: string; obraId?: string };
}) {
  const [estado, onSubmit, pending] = useAccion(accionGuardarProspecto, undefined);
  const [clienteId, setClienteId] = useState(prospecto?.clienteId ?? inicial?.clienteId ?? "");
  const [anonimo, setAnonimo] = useState(prospecto ? !prospecto.clienteId : !inicial?.clienteId);
  const obras = clientes.find((c) => c.id === clienteId)?.obras ?? [];
  const yaTeniaCliente = !!prospecto?.clienteId;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {prospecto && <input type="hidden" name="id" value={prospecto.id} />}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">¿Quién lo pide?</h2>
        {!yaTeniaCliente && (
          <div role="radiogroup" aria-label="Tipo de prospecto" className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!anonimo} onChange={() => setAnonimo(false)} className="size-4 accent-primary" />
              Cliente existente
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={anonimo} onChange={() => setAnonimo(true)} className="size-4 accent-primary" />
              Todavía no sabemos (consulta sin datos)
            </label>
          </div>
        )}

        {!anonimo && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="clienteId">Cliente</Label>
              <select id="clienteId" name="clienteId" required value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={select}>
                <option value="">Elegí un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obraId">Obra</Label>
              <select id="obraId" name="obraId" defaultValue={prospecto?.obraId ?? inicial?.obraId ?? ""} key={clienteId} className={select} disabled={!clienteId}>
                <option value="">{obras.length ? "Elegir después" : "El cliente no tiene obras"}</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.direccion}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label={anonimo ? "Nombre del contacto" : "Contacto (opcional)"} name="contactoNombre" defaultValue={prospecto?.contactoNombre ?? ""} />
          <Campo label="Teléfono" name="contactoTelefono" type="tel" defaultValue={prospecto?.contactoTelefono ?? ""} />
          <Campo label="Email" name="contactoEmail" type="email" defaultValue={prospecto?.contactoEmail ?? ""} />
        </div>
        {anonimo && <p className="text-xs text-muted-foreground">Sin cliente, el presupuesto se numera recién al asociarle un cliente o al emitirlo.</p>}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Pedido</h2>
        <div className="space-y-1.5 sm:w-1/2">
          <Label htmlFor="origen">Origen</Label>
          <select id="origen" name="origen" defaultValue={prospecto?.origen ?? ""} className={select}>
            <option value="">—</option>
            {ORIGENES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <AreaTexto label="¿Qué pidieron?" name="pedido" defaultValue={prospecto?.pedido ?? ""} placeholder="ej.: 9 pases Ø152 en vigas de 29 cm, pisos 8 a 16" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiereVisita" defaultChecked={prospecto?.requiereVisita} className="size-4 accent-primary" />
          Requiere visita técnica
        </label>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Asignados</h2>
        <p className="text-xs text-muted-foreground">Reciben avisos y, si su rol es &ldquo;solo asignados&rdquo;, son los únicos que lo ven.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {usuarios.map((u) => (
            <label key={u.id} className="flex min-h-8 items-center gap-2 text-sm">
              <input type="checkbox" name="asignados" value={u.id} defaultChecked={prospecto?.asignados.includes(u.id)} className="size-4 accent-primary" />
              {u.name}
            </label>
          ))}
        </div>
      </section>

      <MensajeError error={estado?.error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : prospecto ? "Guardar cambios" : "Crear prospecto"}
      </Button>
    </form>
  );
}
