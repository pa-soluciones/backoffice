"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { accionUrlDescarga } from "../actions";

/** Pide una URL firmada (5 min) y la abre: el archivo baja directo de R2. */
/** `destacarPdf`: el PDF como acción principal (carpeta de documentos). */
export function Descargas({ documentoId, pdfPendiente, destacarPdf, nombre }: { documentoId: string; pdfPendiente: boolean; destacarPdf?: boolean; nombre?: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const bajar = (formato: "docx" | "pdf") =>
    start(async () => {
      setError(undefined);
      const r = await accionUrlDescarga(documentoId, formato);
      if (r.url) window.location.assign(r.url);
      else setError(r.error);
    });
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant={destacarPdf ? "default" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() => bajar("pdf")}
        title={pdfPendiente ? "Se genera al descargar" : undefined}
        aria-label={nombre ? `Descargar PDF de ${nombre}` : undefined}
      >
        <Download data-icon="inline-start" /> {pending ? "Preparando…" : "PDF"}
      </Button>
      <Button type="button" variant={destacarPdf ? "ghost" : "outline"} size="sm" disabled={pending} onClick={() => bajar("docx")} aria-label={nombre ? `Descargar Word de ${nombre}` : undefined}>
        {!destacarPdf && <Download data-icon="inline-start" />} Word
      </Button>
      {error && (
        <span role="alert" className="w-full text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
