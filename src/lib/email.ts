import "server-only";

// Envío por API HTTP de Resend (sin SDK). Diseño: spec/email/base.html.

type Contenido = {
  categoria: string;
  titulo: string;
  /** Párrafos de texto plano (se escapan). */
  parrafos: string[];
  codigo?: string;
  boton?: { texto: string; url: string };
  nota?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const F_HEAD = "font-family:'Poppins',Arial,sans-serif";
const F_BODY = "font-family:'Outfit',Arial,sans-serif";

export function renderEmail(c: Contenido) {
  const codigo = c.codigo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td align="center" style="background-color:#f2f4f6;border:1px solid #e1e1e1;border-radius:12px;padding:24px;"><span style="${F_HEAD};font-size:36px;font-weight:700;letter-spacing:12px;color:#1f2123;">${esc(c.codigo)}</span></td></tr></table>`
    : "";
  const boton = c.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td align="center" bgcolor="#f49600" style="border-radius:12px;background-color:#f49600;"><a href="${esc(c.boton.url)}" target="_blank" style="display:inline-block;padding:14px 28px;${F_HEAD};font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1f2123;text-decoration:none;border-radius:12px;">${esc(c.boton.texto)}</a></td></tr></table>`
    : "";
  const parrafos = c.parrafos
    .map((p) => `<p style="margin:0 0 16px 0;${F_BODY};font-size:16px;line-height:24px;color:#1a1a1a;">${esc(p)}</p>`)
    .join("");
  const nota = c.nota
    ? `<p style="margin:8px 0 0 0;${F_BODY};font-size:13px;line-height:20px;color:#5f5e5e;">${esc(c.nota)}</p>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.titulo)}</title></head>
<body style="margin:0;padding:0;background-color:#f2f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f6;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
<tr><td style="background-color:#1f2123;padding:24px 32px;border-radius:12px 12px 0 0;"><img src="${appUrl()}/email/logo-alt.png" width="120" alt="PAS · Piedra Angular Solutions" style="display:block;border:0;width:120px;height:auto;"></td></tr>
<tr><td style="background-color:#f49600;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="background-color:#ffffff;padding:36px 32px 28px 32px;">
<p style="margin:0 0 12px 0;${F_HEAD};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9a5e00;">${esc(c.categoria)}</p>
<h1 style="margin:0 0 16px 0;${F_HEAD};font-size:24px;line-height:32px;font-weight:700;color:#1a1a1a;">${esc(c.titulo)}</h1>
${parrafos}${codigo}${boton}${nota}
</td></tr>
<tr><td style="background-color:#1f2123;padding:24px 32px;border-radius:0 0 12px 12px;">
<p style="margin:0 0 6px 0;${F_HEAD};font-size:13px;font-weight:600;color:#f9f9f9;">Piedra Angular Solutions</p>
<p style="margin:0;${F_BODY};font-size:13px;line-height:22px;"><a href="https://www.pasoluciones.com.ar" style="color:#f49600;text-decoration:none;">www.pasoluciones.com.ar</a></p>
</td></tr>
<tr><td align="center" style="padding:16px 12px;${F_BODY};font-size:12px;line-height:18px;color:#5f5e5e;">Mensaje automático de PAS Backoffice.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Envía un email. Sin RESEND_API_KEY lo muestra en consola, salvo en producción de Vercel (ahí falla). */
export async function enviarEmail(to: string, asunto: string, contenido: Contenido) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.VERCEL_ENV === "production") throw new Error("RESEND_API_KEY no configurada");
    console.info(`[email:dev] Para: ${to} · ${asunto}\n${contenido.parrafos.join("\n")}${contenido.codigo ? `\nCódigo: ${contenido.codigo}` : ""}${contenido.boton ? `\n${contenido.boton.url}` : ""}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "PAS Backoffice <notificaciones@pasoluciones.com.ar>",
      to,
      subject: asunto,
      html: renderEmail(contenido),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
