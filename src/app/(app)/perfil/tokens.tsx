"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo, MensajeError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccion } from "@/hooks/use-accion";
import { accionCrearToken, accionRevocarToken } from "./actions";

type Token = { id: string; activo: boolean; nombre: string; ultimos4: string; expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null; lastUsedIp: string | null };
const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => navigator.clipboard.writeText(texto).then(() => (setOk(true), setTimeout(() => setOk(false), 2000)))}
    >
      {ok ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />} {ok ? "Copiado" : etiqueta}
    </Button>
  );
}

/** Tokens personales para Claude Desktop u otro cliente MCP (spec/11 RF-MCP-02). */
export function TokensMcp({ tokens, url }: { tokens: Token[]; url: string }) {
  const [estado, onSubmit, pending] = useAccion(accionCrearToken, undefined);
  const [revocando, start] = useTransition();
  const config = estado?.token
    ? JSON.stringify(
        { mcpServers: { "pas-backoffice": { command: "npx", args: ["-y", "mcp-remote", url, "--header", "Authorization: Bearer ${PAS_TOKEN}"], env: { PAS_TOKEN: estado.token } } } },
        null,
        2,
      )
    : null;
  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <Campo label="Nombre" name="nombre" required maxLength={80} placeholder="Claude Desktop notebook" className="min-w-56 flex-1" />
        <div className="space-y-1.5">
          <Label htmlFor="dias">Vence en</Label>
          <select id="dias" name="dias" defaultValue="90" className="h-10 rounded-lg border border-input bg-card px-3 text-base md:text-sm">
            <option value="30">30 días</option>
            <option value="90">90 días</option>
            <option value="365">1 año</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          Crear token
        </Button>
        <MensajeError error={estado?.error} />
      </form>

      {estado?.token && config && (
        <div role="status" className="space-y-3 rounded-xl border border-primary bg-primary/10 p-4 text-sm">
          <p className="font-semibold">Copiá el token ahora: no se vuelve a mostrar.</p>
          <code className="block overflow-x-auto rounded-lg bg-card p-2 font-mono text-xs break-all">{estado.token}</code>
          <Copiar texto={estado.token} etiqueta="Copiar token" />
          <p>
            En Claude Desktop, agregalo en <code>claude_desktop_config.json</code> (Configuración → Desarrollador → Editar configuración):
          </p>
          <pre className="overflow-x-auto rounded-lg bg-card p-2 font-mono text-xs">{config}</pre>
          <Copiar texto={config} etiqueta="Copiar configuración" />
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {tokens.map((t) => {
            const activo = t.activo;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {t.nombre} <span className="font-mono text-xs text-muted-foreground">…{t.ultimos4}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.revokedAt ? `Revocado el ${fecha.format(t.revokedAt)}` : activo ? `Vence el ${fecha.format(t.expiresAt)}` : "Vencido"}
                    {t.lastUsedAt ? ` · Último uso ${fecha.format(t.lastUsedAt)}${t.lastUsedIp ? ` desde ${t.lastUsedIp}` : ""}` : " · Sin uso"}
                  </span>
                </span>
                {activo && (
                  <Button type="button" size="sm" variant="outline" disabled={revocando} onClick={() => confirm(`¿Revocar "${t.nombre}"? Deja de funcionar al instante.`) && start(() => accionRevocarToken(t.id))}>
                    Revocar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
