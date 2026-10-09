CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razon_social" text NOT NULL,
	"cuit" text,
	"telefono" text,
	"email" text,
	"notas" text,
	"archivado" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "directores_obra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"empresa" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "obras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nombre" text,
	"direccion" text NOT NULL,
	"localidad" text,
	"provincia" text,
	"director_id" uuid,
	"hys_nombre" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directores_obra" ADD CONSTRAINT "directores_obra_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_director_id_directores_obra_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."directores_obra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_razon_social_uq" ON "clientes" USING btree (f_unaccent(lower(razon_social))) WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "clientes_razon_social_trgm" ON "clientes" USING gin (f_unaccent(lower(razon_social)) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "directores_nombre_trgm" ON "directores_obra" USING gin (f_unaccent(lower(nombre)) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "obras_cliente_id_index" ON "obras" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "obras_director_id_index" ON "obras" USING btree ("director_id");--> statement-breakpoint
CREATE INDEX "obras_direccion_trgm" ON "obras" USING gin (f_unaccent(lower(direccion)) gin_trgm_ops);