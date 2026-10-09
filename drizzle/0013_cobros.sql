CREATE TABLE "cobros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cobro_esperado_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"moneda_recibida" text NOT NULL,
	"tipo_cambio" numeric(14, 4),
	"importe_imputado" numeric(14, 2) NOT NULL,
	"medio" text NOT NULL,
	"referencia" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cobros_esperados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"adicional_id" uuid,
	"concepto" text NOT NULL,
	"descripcion" text NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"moneda" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_cobro_esperado_id_cobros_esperados_id_fk" FOREIGN KEY ("cobro_esperado_id") REFERENCES "public"."cobros_esperados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros_esperados" ADD CONSTRAINT "cobros_esperados_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros_esperados" ADD CONSTRAINT "cobros_esperados_adicional_id_adicionales_id_fk" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cobros_cobro_esperado_id_index" ON "cobros" USING btree ("cobro_esperado_id");--> statement-breakpoint
CREATE INDEX "cobros_esperados_presupuesto_id_index" ON "cobros_esperados" USING btree ("presupuesto_id");