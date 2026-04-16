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
  BEHAVIORAL_SYSTEM_PROMPT,
} from "@/lib/analysis-prompts";
import {
  FeedbackRequest,
  FeedbackResponse,
  feedbackResponseSchema,
} from "@/lib/analysis-schemas";
import { OpenAIRetryError, withOpenAIRetry } from "@/lib/openai-retry";

export interface RunBehavioralAnalysisOptions {
  log: pino.Logger;
  userId?: string;
}

/**
 * Run behavioral analysis against OpenAI with retry + Zod validation.
 * Expects an already-Zod-parsed `FeedbackRequest` — does NOT re-validate input.
 * Throws `OpenAIRetryError` on retry exhaustion; propagates other errors as-is.
 */
export async function runBehavioralAnalysis(
  input: FeedbackRequest,
  opts: RunBehavioralAnalysisOptions,
): Promise<FeedbackResponse> {
  const { log } = opts;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildBehavioralPrompt(input.transcript, input.config);

  return withOpenAIRetry(
    () =>
      openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: BEHAVIORAL_SYSTEM_PROMPT },
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
    { service: "behavioral-analysis", log, userId: opts.userId, model: "gpt-5.4-mini" },
  );
}
