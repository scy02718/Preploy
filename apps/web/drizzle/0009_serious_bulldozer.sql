ALTER TYPE "public"."session_status" ADD VALUE 'failed';--> statement-breakpoint
CREATE TABLE "openai_usage" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd_millis" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "openai_usage_user_date_model_unique" ON "openai_usage" USING btree ("user_id","date","model");