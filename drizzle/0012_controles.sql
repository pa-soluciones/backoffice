ALTER TABLE "documentos" ADD COLUMN "nro" integer;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "alcance" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_control_nro" ON "documentos" USING btree ("presupuesto_id","nro") WHERE "documentos"."tipo" = 'control';