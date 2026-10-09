CREATE TABLE "articulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"unidad" text DEFAULT 'u' NOT NULL,
	"atributos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stock_minimo" numeric(12, 3),
	"costo_promedio_ars" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias_gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_gasto_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"proveedor_id" uuid,
	"destino_presupuesto_id" uuid,
	"moneda" text NOT NULL,
	"tipo_cambio" numeric(14, 4),
	"total" numeric(14, 2) NOT NULL,
	"comprobante_archivo_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"presupuesto_id" uuid,
	"categoria_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"moneda" text NOT NULL,
	"tipo_cambio" numeric(14, 4),
	"proveedor_id" uuid,
	"comprobante_archivo_id" uuid,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gastos_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"cuit" text,
	"telefono" text,
	"email" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"articulo_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"desde" text NOT NULL,
	"hacia" text NOT NULL,
	"costo_unitario_ars" numeric(14, 2) NOT NULL,
	"compra_id" uuid,
	"motivo" text,
	"fecha" date NOT NULL,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movimientos_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "resumen_final" jsonb;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_destino_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("destino_presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_comprobante_archivo_id_archivos_id_fk" FOREIGN KEY ("comprobante_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_comprobante_archivo_id_archivos_id_fk" FOREIGN KEY ("comprobante_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_articulo_id_articulos_id_fk" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastos_presupuesto_id_index" ON "gastos" USING btree ("presupuesto_id");--> statement-breakpoint
CREATE INDEX "gastos_fecha_index" ON "gastos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "stock_movimientos_articulo_id_index" ON "stock_movimientos" USING btree ("articulo_id");--> statement-breakpoint
CREATE INDEX "stock_movimientos_desde_index" ON "stock_movimientos" USING btree ("desde");--> statement-breakpoint
CREATE INDEX "stock_movimientos_hacia_index" ON "stock_movimientos" USING btree ("hacia");--> statement-breakpoint
INSERT INTO "categorias_gasto" ("nombre") VALUES ('Mano de obra'), ('Viáticos'), ('Combustible'), ('Peajes/estacionamiento'), ('Alquiler de equipos'), ('Flete'), ('Comida'), ('Otros');
