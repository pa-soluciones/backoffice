# 01 — Arquitectura y stack

## 1. Principios

1. **Una sola app** Next.js (UI + API + MCP + cron). Sin microservicios. Única excepción: Gotenberg para generar PDF.
2. **Capa de servicios única.** UI (Server Actions), MCP y API llaman a las mismas funciones `services/*`, que validan permisos, aplican reglas de negocio y auditan. Nunca se duplica lógica entre UI y MCP.
3. **Datos derivados se calculan, no se tipean.** Totales, montos en letras, balances, IDs y estado de pagos se calculan en el servidor.
4. **Free tier primero**, con un camino claro de upgrade.

## 2. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript strict** | Igual que la web actual; RSC + Server Actions reducen la API boilerplate. |
| UI | **Tailwind CSS v4 + shadcn/ui (Radix)** con tokens PAS | Componentes accesibles, sin dependencia de un kit cerrado. |
| Formularios / validación | **react-hook-form + Zod** | Zod compartido entre cliente, servidor y MCP (schemas de tools). |
| Tablas | **TanStack Table** | Ordenar, filtrar y paginar listados. |
| DB | **PostgreSQL en Neon** (free: 0,5 GB) | Integración nativa con Vercel; branching para previews. |
| ORM | **Drizzle ORM** + drizzle-kit (migraciones) | Tipado, liviano, SQL explícito. |
| Búsqueda | Postgres `pg_trgm` + `unaccent` | Sin servicio extra. |
| Auth | **Better Auth** (email+password, plugin `twoFactor` TOTP, sesiones en DB) | 2FA y backup codes incluidos; corre en serverless. |
| Archivos | **Cloudflare R2** (free: 10 GB, sin costo de egress), upload directo con URL prefirmada | Evita el límite de 4,5 MB de body en funciones Vercel. |
| Imágenes | Compresión en el **cliente** antes de subir (canvas → WebP/JPEG) | Funciona offline y ahorra storage. |
| DOCX | **docxtemplater + pizzip** sobre los Word originales | Conserva el diseño exacto de los documentos. |
| PDF | **Gotenberg** (LibreOffice) en **Google Cloud Run** (free tier) | Conversión DOCX→PDF fiel; Vercel no puede correr LibreOffice. |
| IA | **Vercel AI SDK** (`ai`) con registro de proveedores | Anthropic, OpenAI, Google, OpenAI-compatible (OpenRouter, Ollama…). |
| MCP | **`mcp-handler`** (adaptador MCP de Vercel), transporte Streamable HTTP en `/api/mcp` | MCP remoto dentro de la misma app. |
| Email | **Resend + React Email** | 3.000 emails/mes gratis. Requiere DNS en `pasoluciones.com.ar`. |
| Push | **web-push** (VAPID) | Gratis, nativo de PWA. |
| PWA / offline | **Serwist** (service worker) + **Dexie** (IndexedDB) | Cache de app shell + cola de sincronización. |
| Cron | **Vercel Cron** | Hobby: 1 ejecución diaria → recordatorios diarios. |
| Tests | **Vitest** (lógica de dominio) + **Playwright** (smoke e2e) | Ver `14-roadmap.md`. |
| Calidad | ESLint, Prettier, `tsc --noEmit` en CI (GitHub Actions) | |

## 3. Diagrama

```
 ┌───────────────┐   ┌───────────────┐
 │ Navegador/PWA │   │ Claude Desktop│ (u otro cliente MCP)
 │  (mobile/desk)│   │  mcp-remote   │
 └──────┬────────┘   └──────┬────────┘
        │ HTTPS              │ HTTPS + Bearer token
 ┌──────▼────────────────────▼──────────────────────────┐
 │                Next.js en Vercel                      │
 │  app/(ui)   Server Actions   /api/mcp   /api/cron/*   │
 │                 │                │          │         │
 │           ┌─────▼────────────────▼──────────▼───┐     │
 │           │   services/* (permisos+reglas+audit)│     │
 │           └──┬──────────┬──────────┬─────────┬──┘     │
 └──────────────┼──────────┼──────────┼─────────┼────────┘
                │          │          │         │
         ┌──────▼───┐ ┌────▼────┐ ┌───▼────┐ ┌──▼──────────────┐
         │ Neon PG  │ │ R2      │ │ Resend │ │ Proveedor IA     │
         └──────────┘ └─────────┘ └────────┘ └─────────────────┘
                          ▲
                   ┌──────┴───────┐
                   │ Gotenberg    │ (Cloud Run, DOCX→PDF)
                   └──────────────┘
```

## 4. Estructura del repositorio

```
pas-backoffice/
├─ spec/                      # estas specs
├─ src/
│  ├─ app/
│  │  ├─ (auth)/              # login, primer inicio, recuperación
│  │  ├─ (app)/               # app autenticada
│  │  │  ├─ explorador/       # clientes → obras → presupuestos
│  │  │  ├─ presupuestos/[id]/
│  │  │  ├─ agenda/
│  │  │  ├─ stock/
│  │  │  ├─ finanzas/
│  │  │  ├─ notificaciones/
│  │  │  └─ ajustes/          # usuarios, roles, empresa, IA, plantillas, numeración
│  │  └─ api/
│  │     ├─ auth/[...all]/    # Better Auth
│  │     ├─ mcp/              # servidor MCP
│  │     ├─ cron/daily/       # recordatorios
│  │     └─ uploads/sign/     # URL prefirmada R2
│  ├─ services/               # lógica de negocio (único punto de entrada)
│  ├─ domain/                 # funciones puras: numeración, estados, montos, balance, número a letras
│  ├─ db/                     # schema Drizzle + migraciones
│  ├─ documents/              # render DOCX/HTML por tipo de documento
│  ├─ ai/                     # registro de proveedores y prompts
│  ├─ mcp/                    # definición de tools (usa services/)
│  ├─ emails/                 # React Email (ver spec/email/)
│  └─ components/
├─ templates/                 # Word con placeholders (versionados)
└─ public/
```

`domain/` no importa nada de DB ni de Next: es puro y es lo que se testea con Vitest.

## 5. Entornos

| Entorno | Deploy | DB |
|---|---|---|
| Local | `next dev` | Neon branch `dev` o Postgres local (Docker) |
| Preview | Vercel preview por PR | Neon branch por PR |
| Producción | Vercel (main) | Neon `main` |

Variables de entorno (todas en Vercel; nunca en el repo):
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOTENBERG_URL`, `GOTENBERG_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `ENCRYPTION_KEY` (AES-256-GCM para API keys de IA guardadas en DB).

## 6. Límites del free tier y mitigación

| Servicio | Límite relevante | Mitigación |
|---|---|---|
| Vercel Hobby | **Solo uso no comercial**; body de función 4,5 MB; duración de función limitada; cron 1/día | Pasar a Pro para producción. Uploads directo a R2. IA con streaming. Recordatorios diarios. |
| Neon Free | 0,5 GB de storage; autosuspend | Archivos fuera de la DB (R2). Primer request tras inactividad tarda ~1 s. |
| R2 Free | 10 GB; 1M escrituras/mes | Imágenes comprimidas (~300–800 KB c/u). |
| Resend Free | 3.000/mes, 100/día | Emails solo para eventos importantes; resto in-app/push. |
| Cloud Run Free | 2M requests/mes | Sobra para el volumen de PDFs. Escala a 0. |

## 7. Generación de PDF — detalle

1. El servidor arma el DOCX con docxtemplater.
2. Lo envía a `POST {GOTENBERG_URL}/forms/libreoffice/convert` con un header de autenticación (Cloud Run con IAM o token compartido).
3. Guarda DOCX y PDF en R2.
4. Si Gotenberg falla o tarda (cold start), el documento queda emitido con DOCX y el PDF en estado `pendiente`. Se reintenta en el próximo intento de descarga y en el cron diario.

Las fuentes Poppins y Outfit (y las que usen los Word) se instalan en la imagen de Gotenberg para que el PDF salga idéntico.
