/**
 * Zod schema for validating the AI STAR story analysis response.
 * Used by the /api/star/[id]/analyze route to parse and validate OpenAI output.
 */

import { z } from "zod/v4";

export const starBreakdownSchema = z.object({
  situation: z.number().min(0).max(100),
  task: z.number().min(0).max(100),
  action: z.number().min(0).max(100),
  result: z.number().min(0).max(100),
});
export type StarBreakdown = z.infer<typeof starBreakdownSchema>;

export const starAnalysisResponseSchema = z.object({
  persuasiveness_score: z.number().min(0).max(100),
  persuasiveness_justification: z.string().min(1),
  star_alignment_score: z.number().min(0).max(100),
  star_breakdown: starBreakdownSchema,
  role_fit_score: z.number().min(0).max(100),
  role_fit_justification: z.string().min(1),
  question_fit_score: z.number().min(0).max(100),
  question_fit_justification: z.string().min(1),
  suggestions: z.array(z.string().min(1)).min(3).max(5),
});
export type StarAnalysisResponse = z.infer<typeof starAnalysisResponseSchema>;

/** Shape stored in star_story_analyses.scores */
export const starScoresSchema = z.object({
  persuasiveness_score: z.number().min(0).max(100),
  persuasiveness_justification: z.string(),
  star_alignment_score: z.number().min(0).max(100),
  star_breakdown: starBreakdownSchema,
  role_fit_score: z.number().min(0).max(100),
  role_fit_justification: z.string(),
  question_fit_score: z.number().min(0).max(100),
  question_fit_justification: z.string(),
});
export type StarScores = z.infer<typeof starScoresSchema>;
