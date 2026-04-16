CREATE TABLE "deleted_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"month" text NOT NULL,
	"usage_count" integer NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "deleted_usage_hash_month_unique" ON "deleted_usage" USING btree ("email_hash","month");