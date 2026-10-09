CREATE TABLE "archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"r2_key" text NOT NULL,
	"nombre" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"sha256" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"entidad_tipo" text,
	"entidad_id" text,
	"categoria" text,
	"descripcion" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "archivos_r2Key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "r2_uso_mensual" (
	"mes" text PRIMARY KEY NOT NULL,
	"ops_a" bigint DEFAULT 0 NOT NULL,
	"ops_b" bigint DEFAULT 0 NOT NULL,
	"aprobado" jsonb,
	"aprobado_por" uuid,
	"aprobado_at" timestamp with time zone,
	"avisados" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_uso_mensual" ADD CONSTRAINT "r2_uso_mensual_aprobado_por_user_id_fk" FOREIGN KEY ("aprobado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archivos_entidad_tipo_entidad_id_index" ON "archivos" USING btree ("entidad_tipo","entidad_id");