import { NextRequest, NextResponse } from "next/server";

import { runBehavioralAnalysis } from "@/lib/analysis-behavioral";
import { feedbackRequestSchema } from "@/lib/analysis-schemas";
import { createRequestLogger } from "@/lib/logger";
import { OpenAIRetryError } from "@/lib/openai-retry";

/**
 * POST /api/analysis/behavioral
 *
 * Internal, server-to-server route. No auth. Thin HTTP wrapper around
 * `runBehavioralAnalysis()` in `@/lib/analysis-behavioral`; the feedback route
 * imports that function directly rather than self-fetching this endpoint.
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

  if (!process.env.OPENAI_API_KEY) {
    log.error("OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await runBehavioralAnalysis(parsed.data, { log });
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
