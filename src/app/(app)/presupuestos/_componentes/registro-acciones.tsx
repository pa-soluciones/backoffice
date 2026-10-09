"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { DatosRegistro } from "@/services/campo";
import { accionEditarRegistro, accionEliminarRegistro } from "../../campo/actions";
import { FormRegistro } from "../../campo/_componentes/form-registro";

type Props = {
  presupuestoId: string;
  codigo: string;
  registroId: string;
  etiqueta: string;
  inicial: DatosRegistro;
  ctx: { items: React.ComponentProps<typeof FormRegistro>["items"]; usuarios: { id: string; name: string }[]; yo: string } | null;
};

/** Editar / eliminar un registro (RF-CMP-05; el servidor valida autor + 48 h o alcance "todos"). */
export function RegistroAcciones({ presupuestoId, codigo, registroId, etiqueta, inicial, ctx }: Props) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <>
      <span className="flex gap-1">
        {ctx && (
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Editar ${etiqueta}`} aria-expanded={editando} onClick={() => setEditando((v) => !v)}>
            <Pencil />
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Eliminar ${etiqueta}`}
          onClick={() => {
            if (!confirm(`¿Eliminar el registro ${etiqueta}? Se borran también sus fotos.`)) return;
            start(async () => {
              const r = await accionEliminarRegistro(presupuestoId, registroId);
              setError("error" in r ? r.error : undefined);
            });
          }}
        >
          <Trash2 />
        </Button>
      </span>
      <div className="w-full empty:hidden">
        <MensajeError error={error} />
        {editando && ctx && (
          <FormRegistro
            presupuestoId={presupuestoId}
            codigo={codigo}
            {...ctx}
            inicial={inicial}
            onGuardar={async (d) => {
              const r = await accionEditarRegistro(presupuestoId, registroId, d);
              if ("error" in r) return r;
              setEditando(false);
            }}
          />
        )}
      </div>
    </>
  );
}
