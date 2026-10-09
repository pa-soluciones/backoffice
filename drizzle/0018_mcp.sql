CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"token_hash" text NOT NULL,
	"ultimos4" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_used_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "mcp_uso" (
	"token_id" uuid NOT NULL,
	"minuto" timestamp with time zone NOT NULL,
	"llamadas" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mcp_uso_token_id_minuto_pk" PRIMARY KEY("token_id","minuto")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "mcp_token_id" uuid;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_uso" ADD CONSTRAINT "mcp_uso_token_id_mcp_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE cascade ON UPDATE no action;