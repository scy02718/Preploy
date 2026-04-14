import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { createRequestLogger } from "@/lib/logger";
import {
  buildTechnicalPrompt,
  TECHNICAL_SYSTEM_PROMPT,
} from "@/lib/analysis-prompts";
import {
  technicalFeedbackRequestSchema,
  technicalFeedbackResponseSchema,
} from "@/lib/analysis-schemas";
import {
  OpenAIRetryError,
  withOpenAIRetry,
} from "@/lib/openai-retry";
import { buildTimeline } from "@/lib/timeline-correlator";

/**
 * POST /api/analysis/technical
 *
 * Internal, server-to-server route ported from FastAPI
 * `/analysis/technical` (apps/api/app/routers/analysis.py). No auth.
 *
 * The deterministic timeline is built locally via `buildTimeline()` and
 * **overwrites** whatever GPT returns for `timeline_analysis` before schema
 * validation. This mirrors the Python `code_analyzer.py` behavior and means
 * the response always contains an authoritative timeline derived from the
 * actual transcript + code snapshots, never a hallucinated one.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ route: "POST /api/analysis/technical" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = technicalFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.transcript.length === 0) {
    return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.error("OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 },
    );
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildTechnicalPrompt(
    parsed.data.transcript,
    parsed.data.code_snapshots,
    parsed.data.config,
  );

  // Build the deterministic timeline ONCE up front; the parseAndValidate
  // closure injects it into every parse attempt, overriding whatever GPT
  // returned for `timeline_analysis`.
  const timeline = buildTimeline(
    parsed.data.transcript,
    parsed.data.code_snapshots,
  );

  try {
    const result = await withOpenAIRetry(
      () =>
        openai.chat.completions.create({
          model: "gpt-5.4-mini",
          messages: [
            { role: "system", content: TECHNICAL_SYSTEM_PROMPT },
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
        // Inject deterministic timeline BEFORE validation. This is the whole
        // reason the technical route exists — we never trust GPT's timeline.
        json.timeline_analysis = timeline;
        const validated = technicalFeedbackResponseSchema.safeParse(json);
        if (!validated.success) {
          throw new OpenAIRetryError("schema_mismatch", validated.error);
        }
        return validated.data;
      },
      { service: "technical-analysis", log },
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OpenAIRetryError) {
      log.error(
        { reason: err.reason },
        "technical analysis exhausted retries",
      );
      return NextResponse.json(
        { error: `GPT response malformed: ${err.reason}` },
        { status: 500 },
      );
    }
    log.error({ err }, "technical analysis failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
