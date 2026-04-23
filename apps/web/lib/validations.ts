import { z } from "zod/v4";

export const behavioralConfigSchema = z.object({
  company_name: z.string().max(200).optional(),
  job_description: z.string().max(5000).optional(),
  expected_questions: z
    .array(z.string().max(500))
    .max(10)
    .optional(),
  interview_style: z.number().min(0).max(1),
  difficulty: z.number().min(0).max(1),
  probe_depth: z.number().int().min(0).max(3).optional(),
  persona: z.string().min(1).max(64).optional(),
  focus_directive: z.string().max(500).optional(),
});

export const technicalConfigSchema = z.object({
  interview_type: z.enum(["leetcode", "system_design", "frontend", "backend"]),
  focus_areas: z.array(z.string()).min(1),
  language: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  additional_instructions: z.string().max(1000).optional(),
  focus_directive: z.string().max(500).optional(),
});

export const problemExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional(),
});

export const problemSchema = z.object({
  title: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  description: z.string().min(1),
  examples: z.array(problemExampleSchema),
  constraints: z.array(z.string()),
});

export const createSessionSchema = z.object({
  type: z.enum(["behavioral", "technical"]),
  config: z.record(z.string(), z.unknown()).optional(),
  source_star_story_id: z.string().uuid().optional(),
  use_pro_analysis: z.boolean().optional(),
});

// ---- Timeline correlator schemas ----
// Named with `Input` suffix to avoid collision with the narrower
// `TranscriptEntry` interface in packages/shared/src/types.ts (which
// constrains `speaker` to "user" | "ai"). These schemas mirror the Python
// Pydantic models used by apps/api/app/services/timeline_correlator.py —
// `speaker` and `event_type` on the input schemas are plain strings to
// match the Pydantic `str` typing exactly.

export const transcriptEntryInputSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  timestamp_ms: z.number().int(),
});
export type TranscriptEntryInput = z.infer<typeof transcriptEntryInputSchema>;

export const codeSnapshotInputSchema = z.object({
  code: z.string(),
  language: z.string(),
  timestamp_ms: z.number().int(),
  event_type: z.string(),
});
export type CodeSnapshotInput = z.infer<typeof codeSnapshotInputSchema>;

export const timelineEventSchema = z.object({
  timestamp_ms: z.number().int(),
  event_type: z.enum(["speech", "code_change"]),
  summary: z.string(),
  code: z.string().nullable().optional(),
  full_text: z.string().nullable().optional(),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

// ---- STAR story schemas ----

export const createStarStorySchema = z.object({
  title: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  expectedQuestions: z.array(z.string().min(1).max(500)).min(1).max(3),
  situation: z.string().min(1).max(5000),
  task: z.string().min(1).max(5000),
  action: z.string().min(1).max(5000),
  result: z.string().min(1).max(5000),
});
export type CreateStarStoryInput = z.infer<typeof createStarStorySchema>;

export const updateStarStorySchema = createStarStorySchema.partial();
export type UpdateStarStoryInput = z.infer<typeof updateStarStorySchema>;

export const listStarStoriesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});
export type ListStarStoriesQuery = z.infer<typeof listStarStoriesQuerySchema>;

// ---- Plan archive PATCH schema ----

export const patchPlanArchiveSchema = z.object({
  archived: z.boolean(),
});
export type PatchPlanArchiveInput = z.infer<typeof patchPlanArchiveSchema>;

// ---- User profile PATCH schema ----

export const patchUserMeSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  image: z.string().trim().optional(),
  gaze_tracking_enabled: z.boolean().optional(),
  tour_completed_at: z.coerce.date().nullable().optional(),
  tour_skipped_at: z.coerce.date().nullable().optional(),
  // IANA timezone name (e.g. "Pacific/Auckland"). The client syncs it on
  // mount; the server uses it for time-of-day achievements (early_bird,
  // night_owl, marathon_runner). Bounded length so we don't accept
  // arbitrarily large strings.
  timezone: z.string().trim().min(1).max(100).optional(),
});
export type PatchUserMeInput = z.infer<typeof patchUserMeSchema>;

// ---- Gaze tracking schemas ----

export const gazeSampleSchema = z.object({
  t: z.number().int().nonnegative(),
  gaze_x: z.number().min(-1).max(1),
  gaze_y: z.number().min(-1).max(1),
  head_yaw: z.number().min(-180).max(180),
  head_pitch: z.number().min(-90).max(90),
  confidence: z.number().min(0).max(1),
});
export type GazeSampleInput = z.infer<typeof gazeSampleSchema>;

export const gazeSamplesBodySchema = z.object({
  samples: z.array(gazeSampleSchema).min(1).max(3600),
});
export type GazeSamplesBody = z.infer<typeof gazeSamplesBodySchema>;

// ---- Resume bullet rewrite schemas ----

export const rewriteBulletSchema = z.object({
  resumeId: z.uuid(),
  bullet: z.string().min(1).max(800),
  roleTitle: z.string().max(200).optional(),
  roleCompany: z.string().max(200).optional(),
});
export type RewriteBulletInput = z.infer<typeof rewriteBulletSchema>;

export const patchResumeBulletSchema = z.object({
  oldBullet: z.string().min(1).max(800),
  newBullet: z.string().min(1).max(800),
});
export type PatchResumeBulletInput = z.infer<typeof patchResumeBulletSchema>;
