CREATE TABLE "estado_historial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"desde" text,
	"hasta" text NOT NULL,
	"motivo" text,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"nro" integer NOT NULL,
	"tipo_servicio" text NOT NULL,
	"elemento" text,
	"diametro_mm" numeric(8, 1),
	"espesor_cm" numeric(8, 1),
	"unidad" text DEFAULT 'u' NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"precio_unitario" numeric(14, 2) NOT NULL,
	"descripcion" text NOT NULL,
	"descripcion_manual" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numeracion_anual" (
	"anio" integer PRIMARY KEY NOT NULL,
	"proximo_numero" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presupuesto_asignados" (
	"presupuesto_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rol_trabajo" text DEFAULT 'operario' NOT NULL,
	CONSTRAINT "presupuesto_asignados_presupuesto_id_user_id_pk" PRIMARY KEY("presupuesto_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "presupuesto_revisiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"nro" integer NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"emitida_at" timestamp with time zone,
	"emitida_por" uuid,
	"totales" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presupuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anio" integer,
	"numero" integer,
	"cliente_id" uuid,
	"obra_id" uuid,
	"estado" text DEFAULT 'prospecto' NOT NULL,
	"estado_anterior" text,
	"requiere_visita" boolean DEFAULT false NOT NULL,
	"moneda" text DEFAULT 'ARS' NOT NULL,
	"tipo_cambio_ref" numeric(14, 4),
	"incluye_iva" boolean DEFAULT false NOT NULL,
	"iva_pct" numeric(5, 2) DEFAULT '21' NOT NULL,
	"validez_dias" integer DEFAULT 7 NOT NULL,
	"forma_contratacion" text DEFAULT 'Ajuste Alzado' NOT NULL,
	"base_ajuste" text DEFAULT 'CAC General' NOT NULL,
	"anticipo_pct" numeric(5, 2) DEFAULT '40' NOT NULL,
	"bonif_tipo" text,
	"bonif_valor" numeric(14, 4),
	"fecha_confirmacion" date,
	"motivo_cierre" text,
	"contacto_nombre" text,
	"contacto_telefono" text,
	"contacto_email" text,
	"origen" text,
	"pedido" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visita_responsables" (
	"visita_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "visita_responsables_visita_id_user_id_pk" PRIMARY KEY("visita_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"inicio" timestamp with time zone,
	"duracion_min" integer DEFAULT 60 NOT NULL,
	"direccion" text,
	"contacto_sitio" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"notas_previas" text,
	"notas_resultado" text,
	"motivo_omision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estado_historial" ADD CONSTRAINT "estado_historial_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estado_historial" ADD CONSTRAINT "estado_historial_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_revision_id_presupuesto_revisiones_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."presupuesto_revisiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_asignados" ADD CONSTRAINT "presupuesto_asignados_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_asignados" ADD CONSTRAINT "presupuesto_asignados_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_revisiones" ADD CONSTRAINT "presupuesto_revisiones_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_revisiones" ADD CONSTRAINT "presupuesto_revisiones_emitida_por_user_id_fk" FOREIGN KEY ("emitida_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_responsables" ADD CONSTRAINT "visita_responsables_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_responsables" ADD CONSTRAINT "visita_responsables_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estado_historial_presupuesto_id_at_index" ON "estado_historial" USING btree ("presupuesto_id","at");--> statement-breakpoint
CREATE INDEX "items_revision_id_nro_index" ON "items" USING btree ("revision_id","nro");--> statement-breakpoint
CREATE INDEX "presupuesto_asignados_user_id_index" ON "presupuesto_asignados" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presupuesto_revisiones_presupuesto_id_nro_index" ON "presupuesto_revisiones" USING btree ("presupuesto_id","nro");--> statement-breakpoint
CREATE UNIQUE INDEX "presupuestos_anio_numero_index" ON "presupuestos" USING btree ("anio","numero");--> statement-breakpoint
CREATE INDEX "presupuestos_estado_updated_at_index" ON "presupuestos" USING btree ("estado","updated_at");--> statement-breakpoint
CREATE INDEX "presupuestos_obra_id_index" ON "presupuestos" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "presupuestos_cliente_id_index" ON "presupuestos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "visitas_presupuesto_id_index" ON "visitas" USING btree ("presupuesto_id");--> statement-breakpoint
CREATE INDEX "visitas_inicio_index" ON "visitas" USING btree ("inicio");