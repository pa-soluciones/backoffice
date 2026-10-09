# 12 — Requisitos no funcionales

## 1. PWA y modo offline

**RNF-01 [M]** App instalable (manifest con nombre "PAS Backoffice", íconos desde `assets/favicon.svg`, `theme_color #1f2123`, `background_color #f2f4f6`, `display: standalone`).
**RNF-02 [M]** Service worker (Serwist): cachea el app shell y los assets; navegación offline a las pantallas de **Campo**.
**RNF-03 [M]** **Datos disponibles offline** (sincronizados al abrir la app con conexión y cada 15 min):
- Presupuestos **asignados al usuario** en estado En progreso: datos, ítems, último balance, registros de campo recientes.
- Catálogo de artículos (para registrar consumos).
- Categorías de gasto.
**RNF-04 [M]** **Acciones offline** (cola en IndexedDB con Dexie):
- Registrar perforación (con fotos ya comprimidas).
- Registrar gasto (con comprobante).
- Registrar consumo de stock.
- Subir fotos/anexos a un presupuesto.
**RNF-05 [M]** Sincronización:
- Cada acción tiene un `client_id` UUID → el servidor la aplica de forma **idempotente** (reintentos no duplican).
- Orden FIFO; reintento con backoff; se dispara al volver la conexión (`online` + Background Sync donde exista).
- Las acciones offline son **altas** (append-only), así que no hay conflictos de edición. Si el servidor la rechaza (ej. el presupuesto pasó a Cancelado), queda en "Pendientes con error" con el motivo y opción de reasignar o descartar.
- Indicador permanente: "Sin conexión · 3 pendientes" / "Sincronizando…" / "Todo sincronizado".
**RNF-06 [M]** Fotos en cola: se guardan comprimidas (≈ 300–800 KB). Si el almacenamiento del navegador supera el 80% de la cuota, se avisa.
**RNF-07 [M]** El resto de la app requiere conexión y lo indica claramente (no muestra datos viejos como si fueran actuales).

## 2. Responsive y accesibilidad
**RNF-08 [M]** Mobile-first; soportado desde 360 px de ancho. Sin scroll horizontal (excepto tablas en desktop con columnas fijas).
**RNF-09 [M]** WCAG 2.1 AA: contraste (ver `02-diseno-ui.md` §1), foco visible, navegación por teclado, labels en todos los inputs, objetivos táctiles ≥ 44 px.
**RNF-10 [M]** Navegadores: Chrome/Edge/Safari/Firefox, últimas 2 versiones; iOS Safari 16.4+ (necesario para push en PWA).

## 3. Performance
**RNF-11 [M]** LCP < 2,5 s en 4G para el dashboard y las listas; interacciones < 200 ms (INP).
**RNF-12 [M]** Listados paginados en servidor (50 por página; scroll infinito en mobile).
**RNF-13 [M]** Búsqueda global < 300 ms (p95) con 10.000 presupuestos.
**RNF-14 [M]** Generar DOCX < 3 s; PDF < 15 s (incluye cold start de Gotenberg). Mientras tanto se muestra el progreso.

## 4. Seguridad
**RNF-15 [M]** Permisos verificados en el servidor en cada operación (`services/`), con filtrado de alcance en SQL.
**RNF-16 [M]** Validación de toda entrada con Zod (UI, API, MCP).
**RNF-17 [M]** Headers: CSP estricta, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
**RNF-18 [M]** CSRF: Server Actions (protección de origen de Next) + cookies `SameSite=Lax`.
**RNF-19 [M]** Archivos en R2 **privados**; acceso solo con URLs firmadas de corta duración (5 min) emitidas tras verificar permisos.
**RNF-20 [M]** Validación de uploads: tipo MIME real (magic bytes), tamaño, extensiones permitidas; los SVG subidos por usuarios no se renderizan inline.
**RNF-21 [M]** Secretos solo en variables de entorno; API keys de terceros guardadas en DB cifradas (AES-256-GCM).
**RNF-22 [M]** Rate limiting: login, recuperación, IA y MCP.
**RNF-23 [M]** Logs sin datos sensibles (sin contraseñas, tokens ni API keys).
**RNF-24 [S]** Dependabot + `npm audit` en CI.

## 5. Datos, backups y retención
**RNF-25 [M]** Backup **diario** de la DB: GitHub Action que corre `pg_dump` y lo sube cifrado a R2 (retención 30 diarios + 12 mensuales). El historial point-in-time del free tier de Neon es corto; esto lo complementa.
**RNF-26 [M]** Procedimiento de restore documentado y probado una vez por trimestre.
**RNF-27 [M]** Los archivos emitidos (DOCX/PDF) nunca se sobrescriben; el hash SHA-256 queda en DB.
**RNF-28 [M]** Eliminación de entidades de negocio: **soft delete** (`deleted_at`) con auditoría; solo el admin puede purgar definitivamente.

## 6. Localización
**RNF-29 [M]** Idioma español (Argentina). Formatos: moneda `$ 1.512.000,00` / `US$ 1.250,00`, fechas `dd/mm/aaaa`, hora 24 h.
**RNF-30 [M]** Zona horaria `America/Argentina/Buenos_Aires` para fechas de negocio (numeración anual, vencimientos, recordatorios). En DB todo en `timestamptz`.
**RNF-31 [M]** Montos en letras en español (`domain/numeroALetras.ts`) para ARS ("PESOS … CON xx/100") y USD ("DÓLARES ESTADOUNIDENSES … CON xx/100").

## 7. Calidad y operación
**RNF-32 [M]** CI en cada PR: typecheck, lint, tests Vitest, build. Preview deploy de Vercel con branch de Neon.
**RNF-33 [M]** Cobertura de tests obligatoria para `domain/`: numeración, workflow, totales/bonificación/IVA, balance, cobros esperados, costo promedio, número a letras.
**RNF-34 [M]** Smoke e2e (Playwright): login + 2FA, crear prospecto → emitir presupuesto → En espera → En progreso, registrar perforación, emitir certificación.
**RNF-35 [S]** Monitoreo de errores (Sentry free tier) y uptime check.
**RNF-36 [M]** Migraciones de DB con drizzle-kit, versionadas y aplicadas en el deploy; nunca cambios manuales en producción.
