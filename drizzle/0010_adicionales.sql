CREATE TABLE "adicionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"nro" integer NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"moneda" text NOT NULL,
	"validez_dias" integer DEFAULT 15 NOT NULL,
	"anticipo_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"mantiene_bonificacion" boolean DEFAULT false NOT NULL,
	"totales" jsonb,
	"emitido_at" timestamp with time zone,
	"aprobado_at" timestamp with time zone,
	"motivo" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "revision_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "adicional_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "adicional_id" uuid;--> statement-breakpoint
ALTER TABLE "adicionales" ADD CONSTRAINT "adicionales_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adicionales" ADD CONSTRAINT "adicionales_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adicionales_presupuesto_id_nro_index" ON "adicionales" USING btree ("presupuesto_id","nro");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_adicional_id_adicionales_id_fk" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_adicional_id_adicionales_id_fk" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_adicional_id_index" ON "documentos" USING btree ("adicional_id");--> statement-breakpoint
CREATE INDEX "items_adicional_id_nro_index" ON "items" USING btree ("adicional_id","nro");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_un_duenio" CHECK (("items"."revision_id" is null) <> ("items"."adicional_id" is null));