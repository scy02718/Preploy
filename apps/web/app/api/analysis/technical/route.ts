import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-utils";
import { runTechnicalAnalysis } from "@/lib/analysis-technical";
import { technicalFeedbackRequestSchema } from "@/lib/analysis-schemas";
import { createRequestLogger } from "@/lib/logger";
import { OpenAIRetryError } from "@/lib/openai-retry";
import { getCurrentUserPlan } from "@/lib/user-plan";
import type { AnalysisTier } from "@/lib/analysis-model";

/**
 * POST /api/analysis/technical
 *
 * Thin HTTP wrapper around `runTechnicalAnalysis()`. Production code imports
 * the function directly (feedback route); this HTTP surface is not used by
 * the app, but it is Internet-reachable, so it must auth and rate-limit like
 * every other OpenAI-burning endpoint.
 *
 * The deterministic timeline is built inside `runTechnicalAnalysis` via
 * `buildTimeline()` and overwrites whatever GPT returns for `timeline_analysis`
 * before schema validation.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ route: "POST /api/analysis/technical" });

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(session.user.id, "openai");
  if (rateLimited) return rateLimited;

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

  if (!process.env.OPENAI_API_KEY) {
    log.error("OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 },
    );
  }

  // Plan is read once per feedback request, not cached from session creation —
  // in-flight analyses finish at the tier the user has at the moment they hit
  // POST. Downgrade mid-session → Free output on this POST if the DB flip
  // landed first. Next session always uses the then-current tier.
  const plan = await getCurrentUserPlan(session.user.id);
  const tier: AnalysisTier = plan === "pro" ? "pro" : "free";

  try {
    const result = await runTechnicalAnalysis(parsed.data, { log, tier });
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
