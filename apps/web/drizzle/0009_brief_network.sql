CREATE TABLE "marketer_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"intent" text NOT NULL,
	"reply" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discard_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "marketer_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'reddit' NOT NULL,
	"external_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"permalink" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classification" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "marketer_drafts" ADD CONSTRAINT "marketer_drafts_post_id_marketer_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."marketer_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketer_drafts" ADD CONSTRAINT "marketer_drafts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marketer_posts_external_id_unique" ON "marketer_posts" USING btree ("external_id");