// Service worker (spec/12 §1): solo las pantallas de Campo funcionan sin conexión.
// - HTML de /campo*: red primero; sin red, la última copia guardada.
// - /_next/static/*: caché primero (los archivos tienen hash, no cambian).
// - Todo lo demás pasa directo: el resto de la app requiere conexión (RNF-07).
// Los datos cargados sin conexión no pasan por acá: van a la cola de IndexedDB (src/lib/cola.ts).

const PAGINAS = "pas-paginas-v1";
const ESTATICOS = "pas-estaticos-v1";
const MAX_ESTATICOS = 400; // ponytail: poda simple por cantidad; por fecha de deploy si crece

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (![PAGINAS, ESTATICOS].includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

const esCampo = (url) => url.origin === self.location.origin && (url.pathname === "/campo" || url.pathname.startsWith("/campo/"));
const esHtml = (req) => req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

/** Guarda la página y los JS/CSS que necesita para abrirse sin conexión. */
async function guardarPagina(url, res) {
  const html = await res.clone().text();
  await (await caches.open(PAGINAS)).put(url, res);
  const estaticos = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const cache = await caches.open(ESTATICOS);
  for (const s of estaticos) if (!(await cache.match(s))) await cache.add(s).catch(() => {});
  const claves = await cache.keys();
  for (const k of claves.slice(0, Math.max(0, claves.length - MAX_ESTATICOS))) await cache.delete(k);
  return html;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then(async (res) => {
            if (res.ok) await (await caches.open(ESTATICOS)).put(req, res.clone());
            return res;
          }),
      ),
    );
    return;
  }

  if (esCampo(url) && esHtml(req) && !req.headers.has("rsc")) {
    const clave = url.origin + url.pathname;
    e.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok && !res.redirected) e.waitUntil(guardarPagina(clave, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(clave)) || sinConexion()),
    );
  }
});

/** Precarga /campo y cada obra listada, para poder abrirlas después sin señal. */
async function precalentar() {
  const res = await fetch("/campo", { headers: { accept: "text/html" }, credentials: "same-origin" });
  if (!res.ok || res.redirected) return;
  const html = await guardarPagina(self.location.origin + "/campo", res);
  const ids = [...new Set([...html.matchAll(/href="\/campo\/([0-9a-f-]{36})"/g)].map((m) => m[1]))];
  for (const id of ids) {
    const r = await fetch(`/campo/${id}`, { headers: { accept: "text/html" }, credentials: "same-origin" }).catch(() => null);
    if (r?.ok && !r.redirected) await guardarPagina(`${self.location.origin}/campo/${id}`, r);
  }
}

self.addEventListener("message", (e) => {
  if (e.data === "precalentar") e.waitUntil(precalentar().catch(() => {}));
  if (e.data === "olvidar") e.waitUntil(caches.delete(PAGINAS)); // al cerrar sesión
});

function sinConexion() {
  return new Response(
    '<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title>' +
      '<body style="font-family:system-ui;padding:2rem;background:#f2f4f6;color:#1f2123"><h1>Sin conexión</h1>' +
      '<p>Esta pantalla todavía no se guardó para usar sin señal. Abrí <a href="/campo">Campo</a> con conexión al menos una vez.</p></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// ── Push (spec/09) ────────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.titulo || "PAS Backoffice", { body: d.cuerpo || "", icon: "/icon.svg", badge: "/icon.svg", data: { link: d.link || "/notificaciones" } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.link || "/", self.location.origin).href;
  e.waitUntil(
    (async () => {
      for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          await c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
