# PAS Backoffice

Gestión de presupuestos, obras, stock y documentación de **Piedra Angular Solutions**. Specs completas en [`spec/`](spec/00-overview.md).

## Desarrollo local

Requisitos: Node 22, pnpm, Docker Desktop.

```bash
cp .env.example .env.local
docker compose up -d        # Postgres + Gotenberg (con fuentes Poppins)
pnpm install
pnpm db:migrate
pnpm dev                    # http://localhost:3000
```

Verificaciones:
- `http://localhost:3000/api/health` → `{ "ok": true, "db": "ok" }`
- `http://localhost:3000/api/dev/pdf` → PDF del template de presupuesto generado por Gotenberg (solo en desarrollo)

## Deploy
- **App:** Vercel (Hobby para pruebas; Pro para uso comercial). Variables en `.env.example`.
- **DB:** Neon (URL pooled en `DATABASE_URL`). Migraciones: `pnpm db:migrate`.
- **PDF:** imagen de `gotenberg/` en Google Cloud Run → `GOTENBERG_URL`.
