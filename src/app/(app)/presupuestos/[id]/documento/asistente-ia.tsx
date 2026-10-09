"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { parrafosDe } from "@/domain/bloques";
import { ACCIONES_IA, type AccionIA } from "@/domain/ia";
import { accionProponerIA } from "../../actions";

type Propuesta = { texto: string; advertencias: string[] };

/** Asistente por bloque (spec/06 RF-PRV-03): pide una propuesta y el usuario la acepta o descarta. */
export function AsistenteIA({
  documentoId,
  bloqueId,
  textoActual,
  onAceptar,
}: {
  documentoId: string;
  bloqueId: string;
  textoActual: string;
  onAceptar: (texto: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [ultimo, setUltimo] = useState<{ accion: AccionIA; instruccion: string | null } | null>(null);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const pedir = (accion: AccionIA, instr: string | null) =>
    start(async () => {
      setError(undefined);
      setUltimo({ accion, instruccion: instr });
      const r = await accionProponerIA(documentoId, bloqueId, accion, instr, textoActual);
      if (r.error || !r.texto) setError(r.error ?? "La IA no devolvió texto.");
      else setPropuesta({ texto: r.texto, advertencias: r.advertencias ?? [] });
    });

  const cerrar = () => {
    setAbierto(false);
    setPropuesta(null);
    setError(undefined);
  };

  if (!abierto) {
    return (
      <Button type="button" variant="ghost" size="xs" onClick={() => setAbierto(true)} aria-label="Asistente de IA">
        <Sparkles data-icon="inline-start" className="text-primary-text" /> IA
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-primary/40 bg-accent/60 p-3">
      {!propuesta ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ACCIONES_IA) as (keyof typeof ACCIONES_IA)[]).map((a) => (
              <Button key={a} type="button" variant="outline" size="xs" disabled={pending} onClick={() => pedir(a, null)}>
                {ACCIONES_IA[a]}
              </Button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pedir("instruccion", instruccion);
            }}
            className="flex gap-2"
          >
            <input
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              maxLength={500}
              placeholder="ej.: agregá que trabajamos en horario nocturno"
              aria-label="Instrucción para la IA"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending || !instruccion.trim()}>
              Pedir
            </Button>
          </form>
          {pending && (
            <p role="status" className="text-sm text-muted-foreground">
              Redactando…
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Propuesta de la IA</p>
          <div className="space-y-1 rounded-lg border bg-card p-3 text-sm">
            {parrafosDe(propuesta.texto).map((p, i) => (
              <p key={i}>{p.runs.map((r, j) => (r.b ? <strong key={j}>{r.t}</strong> : <span key={j}>{r.t}</span>))}</p>
            ))}
          </div>
          {propuesta.advertencias.length > 0 && (
            <p role="alert" className="text-xs font-semibold text-warning">
              La IA agregó cifras que no estaban: {propuesta.advertencias.join(", ")}. Revisalas antes de aceptar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAceptar(propuesta.texto);
                cerrar();
              }}
            >
              Aceptar
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => ultimo && pedir(ultimo.accion, ultimo.instruccion)}>
              {pending ? "Redactando…" : "Reintentar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPropuesta(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
      <MensajeError error={error} />
      <button type="button" onClick={cerrar} className="text-xs text-muted-foreground hover:underline">
        Cerrar asistente
      </button>
    </div>
  );
}
