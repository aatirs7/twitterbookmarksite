CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"anthropic_key_enc" text,
	"anthropic_key_hint" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
