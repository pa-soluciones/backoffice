CREATE TABLE "documento_versiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"nro" integer NOT NULL,
	"bloques" jsonb NOT NULL,
	"origen" text NOT NULL,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"revision_id" uuid,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"bloques" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"emitido_at" timestamp with time zone,
	"emitido_por" uuid,
	"snapshot" jsonb,
	"docx_archivo_id" uuid,
	"pdf_archivo_id" uuid,
	"pdf_estado" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_revision_id_presupuesto_revisiones_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."presupuesto_revisiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_emitido_por_user_id_fk" FOREIGN KEY ("emitido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_docx_archivo_id_archivos_id_fk" FOREIGN KEY ("docx_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pdf_archivo_id_archivos_id_fk" FOREIGN KEY ("pdf_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documento_versiones_documento_id_nro_index" ON "documento_versiones" USING btree ("documento_id","nro");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_revision_id_index" ON "documentos" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "documentos_presupuesto_id_index" ON "documentos" USING btree ("presupuesto_id");