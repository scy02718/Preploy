import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { starStories, starStoryAnalyses } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import OpenAI from "openai";
import {
  buildStarAnalysisPrompt,
  STAR_ANALYSIS_MODEL,
  STAR_ANALYSIS_SYSTEM_PROMPT,
  type StarStoryInput,
} from "@/lib/star-prompt-builder";
import { starAnalysisResponseSchema } from "@/lib/star-analysis-schema";
import { OpenAIRetryError, withOpenAIRetry } from "@/lib/openai-retry";

// POST /api/star/[id]/analyze — run AI analysis on a STAR story
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(session.user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const log = createRequestLogger({
    route: "POST /api/star/[id]/analyze",
    userId: session.user.id,
    storyId: id,
  });

  // Fetch and verify ownership
  const [story] = await db
    .select()
    .from(starStories)
    .where(
      and(eq(starStories.id, id), eq(starStories.userId, session.user.id))
    );

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const storyInput: StarStoryInput = {
    title: story.title,
    role: story.role,
    expectedQuestions: (story.expectedQuestions as string[]) ?? [],
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
  };

  const prompt = buildStarAnalysisPrompt(storyInput);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const analysisResult = await withOpenAIRetry(
      () =>
        openai.chat.completions.create({
          model: STAR_ANALYSIS_MODEL,
          messages: [
            { role: "system", content: STAR_ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_completion_tokens: 2000,
        }),
      (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch (e) {
          throw new OpenAIRetryError("invalid_json", e);
        }
        const validated = starAnalysisResponseSchema.safeParse(json);
        if (!validated.success) {
          throw new OpenAIRetryError("schema_mismatch", validated.error);
        }
        return validated.data;
      },
      { service: "star-analysis", log, userId: session.user.id, model: STAR_ANALYSIS_MODEL }
    );

    const { suggestions, ...scores } = analysisResult;

    const [analysis] = await db
      .insert(starStoryAnalyses)
      .values({
        storyId: id,
        scores,
        suggestions,
        model: STAR_ANALYSIS_MODEL,
      })
      .returning();

    log.info({ analysisId: analysis.id }, "STAR story analysis complete");
    return NextResponse.json(analysis, { status: 201 });
  } catch (err) {
    if (err instanceof OpenAIRetryError) {
      log.error({ err, reason: err.reason }, "AI analysis failed after retry");
      return NextResponse.json(
        { error: "AI analysis failed. Please try again." },
        { status: 500 }
      );
    }
    log.error({ err }, "unexpected error during STAR analysis");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
