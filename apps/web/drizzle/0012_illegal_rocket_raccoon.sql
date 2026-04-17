ALTER TABLE "session_feedback" ADD COLUMN "gaze_consistency_score" real;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD COLUMN "gaze_distribution" jsonb;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD COLUMN "gaze_coverage" real;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD COLUMN "gaze_timeline" jsonb;