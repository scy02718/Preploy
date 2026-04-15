CREATE TABLE "interview_usage" (
	"user_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_usage" ADD CONSTRAINT "interview_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interview_usage_user_period_unique" ON "interview_usage" USING btree ("user_id","period_start");