CREATE TABLE "jornada_operarios" (
	"jornada_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "jornada_operarios_jornada_id_user_id_pk" PRIMARY KEY("jornada_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "jornadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"notas" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"cuerpo" text,
	"link" text,
	"entidad_tipo" text,
	"entidad_id" text,
	"agrupada_count" integer DEFAULT 1 NOT NULL,
	"leida_at" timestamp with time zone,
	"email_estado" text,
	"email_intentos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferencias_usuario" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"notificaciones" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_suscripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_suscripciones_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recordatorios_enviados" (
	"tipo" text NOT NULL,
	"entidad_id" text NOT NULL,
	"fecha" date NOT NULL,
	CONSTRAINT "recordatorios_enviados_tipo_entidad_id_fecha_pk" PRIMARY KEY("tipo","entidad_id","fecha")
);
--> statement-breakpoint
ALTER TABLE "jornada_operarios" ADD CONSTRAINT "jornada_operarios_jornada_id_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornada_operarios" ADD CONSTRAINT "jornada_operarios_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_usuario" ADD CONSTRAINT "preferencias_usuario_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_suscripciones" ADD CONSTRAINT "push_suscripciones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jornadas_fecha_index" ON "jornadas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "jornadas_presupuesto_id_index" ON "jornadas" USING btree ("presupuesto_id");--> statement-breakpoint
CREATE INDEX "notificaciones_user_id_created_at_index" ON "notificaciones" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notificaciones_email_estado_index" ON "notificaciones" USING btree ("email_estado");