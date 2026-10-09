@AGENTS.md

# PAS Backoffice

Specs en `spec/` (empezar por `spec/00-overview.md`). Roadmap por fases en `spec/14-roadmap.md`.

## Reglas del proyecto
- Toda lógica de negocio va en `src/services/` (permisos + reglas + auditoría). UI (Server Actions), MCP y cron llaman a services; nunca duplicar lógica.
- Funciones puras de dominio (numeración, workflow, montos, balance) en `src/domain/`, sin imports de DB ni Next, con tests Vitest.
- Montos `numeric(14,2)`; formato es-AR; zona horaria America/Argentina/Buenos_Aires.
- DB: Drizzle con `casing: "snake_case"`. Cambios de schema → `pnpm db:generate` (nunca editar migraciones ya aplicadas).
- Colores: usar tokens (`bg-primary`, `text-primary-text`…). Naranja `#f49600` nunca como color de texto sobre fondo claro.
- UI y textos en español rioplatense.
- R2 (archivos): nunca usar `src/lib/r2.ts` directo; todo pasa por `src/services/almacenamiento.ts`, que reserva cupo del free tier (`cuota-r2.ts`) antes de cada operación.
- R2 (archivos): nunca usar `src/lib/r2.ts` directo; todo pasa por `src/services/almacenamiento.ts`, que reserva cupo del free tier (`cuota-r2.ts`) antes de cada operación.

## Comandos
- `docker compose up -d` → Postgres (5432) + Gotenberg (3001) + mock S3 de R2 (9000) + mock S3 de R2 (9000)
- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm db:migrate` · `pnpm db:studio`
- `pnpm test` → unitarios + integración (usa la base `pas_test` y el mock S3) · `pnpm e2e` → Playwright contra un build
- `pnpm test` → unitarios + integración (usa la base `pas_test` y el mock S3) · `pnpm e2e` → Playwright contra un build
