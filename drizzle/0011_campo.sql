CREATE TABLE "registro_operarios" (
	"registro_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "registro_operarios_registro_id_user_id_pk" PRIMARY KEY("registro_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "registros_campo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"item_id" uuid,
	"fecha" date NOT NULL,
	"piso" text NOT NULL,
	"elemento" text NOT NULL,
	"tipo_servicio" text DEFAULT 'perforacion' NOT NULL,
	"espesor_cm" numeric(8, 1),
	"diametro_mm" numeric(8, 1),
	"unidad" text DEFAULT 'u' NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"estado" text DEFAULT 'finalizado' NOT NULL,
	"observacion" text,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registros_campo_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "archivos" ADD COLUMN "tomada_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registro_operarios" ADD CONSTRAINT "registro_operarios_registro_id_registros_campo_id_fk" FOREIGN KEY ("registro_id") REFERENCES "public"."registros_campo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_operarios" ADD CONSTRAINT "registro_operarios_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_campo" ADD CONSTRAINT "registros_campo_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_campo" ADD CONSTRAINT "registros_campo_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_campo" ADD CONSTRAINT "registros_campo_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registros_campo_presupuesto_id_fecha_index" ON "registros_campo" USING btree ("presupuesto_id","fecha");