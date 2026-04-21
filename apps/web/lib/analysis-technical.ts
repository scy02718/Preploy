/**
 * Pure TS runner for technical analysis, extracted from
 * `app/api/analysis/technical/route.ts` so the feedback route can call the
 * OpenAI pipeline directly (no HTTP hop).
 *
 * Critical invariant: the deterministic timeline from `buildTimeline()`
 * overwrites whatever GPT returned for `timeline_analysis` BEFORE Zod
 * validation. Mirrors the Python `code_analyzer.py` behavior — we never trust
 * GPT's timeline.
 */

import type pino from "pino";
import OpenAI from "openai";

import {
  buildTechnicalPrompt,
  systemPromptFor,
} from "@/lib/analysis-prompts";
import {
  TechnicalFeedbackRequest,
  TechnicalFeedbackResponse,
  technicalFeedbackResponseSchema,
} from "@/lib/analysis-schemas";
import { OpenAIRetryError, withOpenAIRetry } from "@/lib/openai-retry";
import { buildTimeline } from "@/lib/timeline-correlator";
import { modelFor, type AnalysisTier } from "@/lib/analysis-model";

export interface RunTechnicalAnalysisOptions {
  log: pino.Logger;
  userId?: string;
  /** User tier — determines model and system prompt depth */
  tier: AnalysisTier;
}

export async function runTechnicalAnalysis(
  input: TechnicalFeedbackRequest,
  opts: RunTechnicalAnalysisOptions,
): Promise<TechnicalFeedbackResponse> {
  const { log } = opts;
  const model = modelFor(opts.tier);
  const systemPrompt = systemPromptFor("technical", opts.tier);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildTechnicalPrompt(
    input.transcript,
    input.code_snapshots,
    input.config,
  );

  // Build the deterministic timeline ONCE up front; the parseAndValidate
  // closure injects it into every parse attempt, overriding whatever GPT
  // returned for `timeline_analysis`.
  const timeline = buildTimeline(input.transcript, input.code_snapshots);

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
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch (e) {
        throw new OpenAIRetryError("invalid_json", e);
      }
      // Inject deterministic timeline BEFORE validation.
      json.timeline_analysis = timeline;
      const validated = technicalFeedbackResponseSchema.safeParse(json);
      if (!validated.success) {
        throw new OpenAIRetryError("schema_mismatch", validated.error);
      }
      return validated.data;
    },
    { service: "technical-analysis", log, userId: opts.userId, model },
  );
}
