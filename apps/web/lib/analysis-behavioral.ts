/**
 * Pure TS runner for behavioral analysis, extracted from
 * `app/api/analysis/behavioral/route.ts` so the feedback route can call the
 * OpenAI pipeline directly (no HTTP hop).
 *
 * The thin HTTP route still exists and wraps this function, but
 * `app/api/sessions/[id]/feedback/route.ts` now imports this function directly
 * to avoid a self-fetch to a localhost port.
 */

import type pino from "pino";
import OpenAI from "openai";

import {
  buildBehavioralPrompt,
  systemPromptFor,
  type PreparedStarStory,
} from "@/lib/analysis-prompts";
import {
  FeedbackRequest,
  FeedbackResponse,
  feedbackResponseSchema,
} from "@/lib/analysis-schemas";
import { OpenAIRetryError, withOpenAIRetry } from "@/lib/openai-retry";
import { modelFor, type AnalysisTier } from "@/lib/analysis-model";

export interface RunBehavioralAnalysisOptions {
  log: pino.Logger;
  userId?: string;
  /** Optional prepared STAR story for drift analysis */
  preparedStory?: PreparedStarStory;
  /** User tier — determines model and system prompt depth */
  tier: AnalysisTier;
}

/**
 * Run behavioral analysis against OpenAI with retry + Zod validation.
 * Expects an already-Zod-parsed `FeedbackRequest` — does NOT re-validate input.
 * Throws `OpenAIRetryError` on retry exhaustion; propagates other errors as-is.
 *
 * When `opts.preparedStory` is provided the prompt includes the candidate's
 * written STAR story and drift-analysis instructions; the returned
 * `FeedbackResponse` will contain a `drift_analysis` field.
 */
export async function runBehavioralAnalysis(
  input: FeedbackRequest,
  opts: RunBehavioralAnalysisOptions,
): Promise<FeedbackResponse> {
  const { log } = opts;
  const model = modelFor(opts.tier);
  const systemPrompt = systemPromptFor("behavioral", opts.tier);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildBehavioralPrompt(input.transcript, input.config, opts.preparedStory);

  return withOpenAIRetry(
    () =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_completion_tokens: 4000,
      }),
    (raw) => {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        throw new OpenAIRetryError("invalid_json", e);
      }
      const validated = feedbackResponseSchema.safeParse(json);
      if (!validated.success) {
        throw new OpenAIRetryError("schema_mismatch", validated.error);
      }
      return validated.data;
    },
    { service: "behavioral-analysis", log, userId: opts.userId, model },
  );
}
