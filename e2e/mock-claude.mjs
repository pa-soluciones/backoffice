// Simulador mínimo de POST /v1/messages para los e2e (sin costo ni clave real).
// Valida lo que la app tiene que mandar y responde un texto fijo.
import { createServer } from "node:http";

createServer((req, res) => {
  if (req.method === "GET") return res.writeHead(200).end("ok");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const b = JSON.parse(body || "{}");
    const errores = [
      !String(req.headers["anthropic-beta"] ?? "").includes("server-side-fallback-2026-07-01") && "falta beta de fallback",
      b.fallbacks !== "default" && "falta fallbacks",
      b.output_config?.effort !== "low" && "effort",
      !b.model?.startsWith("claude-") && "modelo",
      !b.messages?.[0]?.content?.includes("Datos del documento") && "contexto",
    ].filter(Boolean);
    if (errores.length) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: errores.join(", ") } }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_mock",
        type: "message",
        role: "assistant",
        model: b.model,
        content: [
          {
            type: "text",
            text: b.messages[0].content.includes("cotizadas")
              ? "Se ejecutaron todas las perforaciones de Ø 152 mm previstas en el período, sin interferencias."
              : "Garantía de **12 meses** sobre la mano de obra, desde la finalización de los trabajos.",
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 60 },
      }),
    );
  });
}).listen(3199);
