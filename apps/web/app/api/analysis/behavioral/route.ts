import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { createRequestLogger } from "@/lib/logger";
import {
  buildBehavioralPrompt,
  BEHAVIORAL_SYSTEM_PROMPT,
} from "@/lib/analysis-prompts";
import {
  feedbackRequestSchema,
  feedbackResponseSchema,
} from "@/lib/analysis-schemas";
import {
  OpenAIRetryError,
  withOpenAIRetry,
} from "@/lib/openai-retry";

/**
 * POST /api/analysis/behavioral
 *
 * Internal, server-to-server route ported from FastAPI
 * `/analysis/behavioral` (apps/api/app/routers/analysis.py). No auth — matches
 * the original which is reachable only from `apps/web/app/api/sessions/[id]/feedback/route.ts`.
 *
 * Story 23 will swap the existing feedback route to call this one. Until then
 * this endpoint runs in parallel for byte-equivalent validation.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ route: "POST /api/analysis/behavioral" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackRequestSchema.safeParse(body);
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
  const prompt = buildBehavioralPrompt(parsed.data.transcript, parsed.data.config);

  try {
    const result = await withOpenAIRetry(
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
      { service: "behavioral-analysis", log },
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OpenAIRetryError) {
      log.error(
        { reason: err.reason },
        "behavioral analysis exhausted retries",
      );
      return NextResponse.json(
        { error: `GPT response malformed: ${err.reason}` },
        { status: 500 },
      );
    }
    log.error({ err }, "behavioral analysis failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
