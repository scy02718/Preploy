/**
 * Zod schemas for the behavioral + technical analysis routes.
 *
 * Mirror the Pydantic models in `apps/api/app/schemas.py` field-for-field so
 * the cutover in Story 23 can swap the FastAPI service out without changing
 * the wire format consumed by `apps/web/app/api/sessions/[id]/feedback/route.ts`.
 *
 * Naming note: `technicalAnalysisConfigSchema` here is intentionally a loose
 * `z.record` to match Pydantic's `dict` typing on `TechnicalFeedbackRequest`.
 * The strict `technicalConfigSchema` in `validations.ts` validates a different
 * shape (the session-creation config UI) and must not be reused here.
 */

import { z } from "zod/v4";
import {
  codeSnapshotInputSchema,
  timelineEventSchema,
  transcriptEntryInputSchema,
} from "./validations";

// ---- Behavioral config (mirrors Pydantic BehavioralConfig) ----

export const behavioralAnalysisConfigSchema = z.object({
  company_name: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  expected_questions: z.array(z.string()).nullable().optional(),
  interview_style: z.number().default(0.5),
  difficulty: z.number().default(0.5),
});
export type BehavioralAnalysisConfig = z.infer<typeof behavioralAnalysisConfigSchema>;

// ---- Behavioral request / response ----

export const feedbackRequestSchema = z.object({
  session_id: z.string(),
  transcript: z.array(transcriptEntryInputSchema),
  // `prefault({})` (instead of `.default({})`) ensures the inner schema runs
  // when `config` is omitted, so its nested `interview_style` / `difficulty`
  // defaults populate the parsed object — matching the Pydantic default of
  // `BehavioralConfig()`.
  config: behavioralAnalysisConfigSchema.prefault({}),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const answerAnalysisSchema = z.object({
  question: z.string(),
  answer_summary: z.string(),
  score: z.number().min(0).max(10),
  feedback: z.string(),
  suggestions: z.array(z.string()),
});
export type AnswerAnalysis = z.infer<typeof answerAnalysisSchema>;

export const driftAnalysisSchema = z.object({
  added: z.array(z.string()),
  omitted: z.array(z.string()),
  tightened: z.array(z.string()),
  loosened: z.array(z.string()),
}).nullable();
export type DriftAnalysis = z.infer<typeof driftAnalysisSchema>;

export const feedbackResponseSchema = z.object({
  overall_score: z.number().min(0).max(10),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  answer_analyses: z.array(answerAnalysisSchema),
  drift_analysis: driftAnalysisSchema.optional(),
});
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

// ---- Technical config (loose dict, mirrors Pydantic dict typing) ----

export const technicalAnalysisConfigSchema = z.record(z.string(), z.unknown());
export type TechnicalAnalysisConfig = z.infer<typeof technicalAnalysisConfigSchema>;

// ---- Technical request / response ----

export const technicalFeedbackRequestSchema = z.object({
  session_id: z.string(),
  transcript: z.array(transcriptEntryInputSchema),
  code_snapshots: z.array(codeSnapshotInputSchema),
  config: technicalAnalysisConfigSchema,
});
export type TechnicalFeedbackRequest = z.infer<typeof technicalFeedbackRequestSchema>;

export const technicalFeedbackResponseSchema = z.object({
  overall_score: z.number().min(0).max(10),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  code_quality_score: z.number().min(0).max(10),
  explanation_quality_score: z.number().min(0).max(10),
  answer_analyses: z.array(answerAnalysisSchema),
  timeline_analysis: z.array(timelineEventSchema),
});
export type TechnicalFeedbackResponse = z.infer<typeof technicalFeedbackResponseSchema>;
