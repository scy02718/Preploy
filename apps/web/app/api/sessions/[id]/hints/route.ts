import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { getHintLimit } from "@/lib/plans";
import { buildHintPrompt } from "@/lib/hint-prompt";
import OpenAI from "openai";

const HintRequestSchema = z.object({
  problemTitle: z.string().min(1),
  problemDescription: z.string().min(1),
  code: z.string().min(0),
  language: z.string().min(1),
});

// POST /api/sessions/[id]/hints — request a coaching hint for a technical session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/sessions/[id]/hints",
    userId: session.user.id,
  });

  // Verify session ownership and existence
  const [found] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.userId, session.user.id)
      )
    );

  if (!found) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Guard: hints are only for technical sessions
  if (found.type !== "technical") {
    return NextResponse.json(
      { error: "Hints are only available for technical interview sessions" },
      { status: 400 }
    );
  }

  // Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = HintRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { problemTitle, problemDescription, code, language } = parsed.data;

  // Resolve plan and quota
  const plan = await getCurrentUserPlan(session.user.id);
  const limit = getHintLimit(plan);
  const currentHintsUsed = found.hintsUsed ?? 0;

  if (currentHintsUsed >= limit) {
    log.info(
      { sessionId: id, hintsUsed: currentHintsUsed, limit, plan },
      "hint quota exhausted"
    );
    return NextResponse.json(
      {
        error: "Hint quota exhausted for this session",
        hintsUsed: currentHintsUsed,
        hintsRemaining: 0,
        limit,
      },
      { status: 429 }
    );
  }

  // Rate-limit check (burst protection, independent of per-session quota)
  const rateLimitResponse = await checkRateLimit(session.user.id, "openai");
  if (rateLimitResponse) return rateLimitResponse;

  // Read prior hints from DB (server-authoritative for dedup)
  const priorHints = ((found.hintsGiven ?? []) as Array<{ text: string }>).map(
    (h) => h.text
  );

  // Build prompt
  const { systemPrompt, userMessage } = buildHintPrompt({
    problemTitle,
    problemDescription,
    code,
    language,
    priorHints,
  });

  // Call OpenAI — construct inside the handler (never at module scope)
  const model = process.env.HINT_MODEL ?? "gpt-5.4-mini";
  let hintText: string;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.4,
    });
    hintText = completion.choices[0]?.message?.content ?? "";
    if (!hintText) {
      throw new Error("Empty response from OpenAI");
    }
  } catch (err) {
    log.error({ err, sessionId: id }, "OpenAI hint generation failed");
    return NextResponse.json(
      { error: "Hint generation failed. Please try again." },
      { status: 500 }
    );
  }

  // Atomically increment hints_used and append hint to hints_given
  // Optimistic lock on hints_used to prevent double-submit races.
  const newHintsUsed = currentHintsUsed + 1;
  const newHint = { text: hintText };
  const updatedRows = await db
    .update(interviewSessions)
    .set({
      hintsUsed: sql`${interviewSessions.hintsUsed} + 1`,
      hintsGiven: sql`${interviewSessions.hintsGiven} || ${JSON.stringify([newHint])}::jsonb`,
    })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.hintsUsed, currentHintsUsed)
      )
    )
    .returning({ hintsUsed: interviewSessions.hintsUsed });

  // If 0 rows updated, a concurrent request beat us — re-read and return 429
  if (updatedRows.length === 0) {
    const [refetched] = await db
      .select({ hintsUsed: interviewSessions.hintsUsed })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id));
    const actualUsed = refetched?.hintsUsed ?? limit;
    log.warn(
      { sessionId: id, actualUsed, limit },
      "optimistic lock conflict — concurrent hint request"
    );
    return NextResponse.json(
      {
        error: "Hint quota exhausted for this session",
        hintsUsed: actualUsed,
        hintsRemaining: Math.max(0, limit - actualUsed),
        limit,
      },
      { status: 429 }
    );
  }

  const hintsRemaining = Math.max(0, limit - newHintsUsed);

  log.info(
    { sessionId: id, hintsUsed: newHintsUsed, hintsRemaining, plan, model },
    "hint generated"
  );

  return NextResponse.json(
    {
      hint: hintText,
      hintsUsed: newHintsUsed,
      hintsRemaining,
    },
    { status: 201 }
  );
}
