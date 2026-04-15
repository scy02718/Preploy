CREATE TABLE "star_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"role" text NOT NULL,
	"expected_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"situation" text NOT NULL,
	"task" text NOT NULL,
	"action" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "star_story_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "source_star_story_id" uuid;--> statement-breakpoint
ALTER TABLE "star_stories" ADD CONSTRAINT "star_stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_story_analyses" ADD CONSTRAINT "star_story_analyses_story_id_star_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."star_stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_source_star_story_id_star_stories_id_fk" FOREIGN KEY ("source_star_story_id") REFERENCES "public"."star_stories"("id") ON DELETE set null ON UPDATE no action;