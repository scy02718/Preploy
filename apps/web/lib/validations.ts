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
});

export const technicalConfigSchema = z.object({
  interview_type: z.enum(["leetcode", "system_design", "frontend", "backend"]),
  focus_areas: z.array(z.string()).min(1),
  language: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  additional_instructions: z.string().max(1000).optional(),
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
