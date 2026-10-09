-- Búsqueda tolerante a acentos y errores de tipeo (spec/04-clientes-obras.md §6)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
