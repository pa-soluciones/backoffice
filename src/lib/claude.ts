import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Cliente de Claude (API de Anthropic). La clave va en ANTHROPIC_API_KEY (variable de entorno);
// nunca se guarda en la base ni llega al navegador.

let cliente: Anthropic | null = null;

export const claudeConfigurado = () => !!process.env.ANTHROPIC_API_KEY;

function client() {
  cliente ??= new Anthropic({ timeout: 60_000, maxRetries: 2 });
  return cliente;
}

export class IARechazo extends Error {}

/**
 * Una llamada de texto. Effort bajo: reescribir párrafos es una tarea simple.
 * Con `fallbacks: "default"`, si el modelo rechaza el pedido por seguridad el servidor
 * reintenta con otro modelo adecuado dentro de la misma llamada.
 */
export async function completar(modelo: string, system: string, prompt: string) {
  const inicio = Date.now();
  const r = await client().beta.messages.create({
    model: modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (r.stop_reason === "refusal") throw new IARechazo("La IA no pudo procesar este pedido. Probá reformulando la instrucción.");
  const texto = r.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  return { texto, modelo: r.model, tokensEntrada: r.usage.input_tokens, tokensSalida: r.usage.output_tokens, ms: Date.now() - inicio };
}
