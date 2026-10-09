"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { accionUrlDescarga } from "../actions";

/** Pide una URL firmada (5 min) y la abre: el archivo baja directo de R2. */
export function Descargas({ documentoId, pdfPendiente }: { documentoId: string; pdfPendiente: boolean }) {
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
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => bajar("pdf")} title={pdfPendiente ? "Se genera al descargar" : undefined}>
        <Download data-icon="inline-start" /> PDF
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => bajar("docx")}>
        <Download data-icon="inline-start" /> Word
      </Button>
      {error && (
        <span role="alert" className="w-full text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
