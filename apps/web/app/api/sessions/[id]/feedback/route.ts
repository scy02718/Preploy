import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  transcripts,
  codeSnapshots,
  sessionFeedback,
} from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { setSentryUser, setSentryContext } from "@/lib/sentry-utils";
import { isTechnicalFeedbackComplete } from "@/lib/feedback-utils";
import { createRequestLogger } from "@/lib/logger";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

// POST /api/sessions/[id]/feedback — trigger feedback generation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/sessions/[id]/feedback",
    userId: session.user.id,
  });

  setSentryUser(session.user);

  // Verify session ownership
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

  setSentryContext({ sessionType: found.type, sessionId: id });

  // Check if feedback already exists
  const [existing] = await db
    .select()
    .from(sessionFeedback)
    .where(eq(sessionFeedback.sessionId, id));

  if (existing) {
    // For technical sessions, a stale/incomplete row (any of the three
    // technical fields null) must be discarded so we regenerate. Behavioral
    // sessions still short-circuit on any existing row.
    // TODO(concurrency): two simultaneous POSTs on the same incomplete
    // technical session could each DELETE and then each INSERT, yielding a
    // duplicate row. Pre-existing race — not introduced here. Fix requires a
    // unique index on sessionFeedback.sessionId or a transactional
    // delete+insert.
    if (found.type === "technical" && !isTechnicalFeedbackComplete(existing)) {
      log.warn(
        { sessionId: id },
        "deleting incomplete technical feedback row, regenerating"
      );
      await db
        .delete(sessionFeedback)
        .where(eq(sessionFeedback.sessionId, id));
    } else {
      return NextResponse.json(existing);
    }
  }

  // Get transcript
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.sessionId, id));

  if (!transcript || !Array.isArray(transcript.entries) || transcript.entries.length === 0) {
    return NextResponse.json(
      { error: "No transcript found for this session" },
      { status: 400 }
    );
  }

  // For technical sessions, also fetch code snapshots
  const isTechnical = found.type === "technical";
  let snapshotRows: { code: string; language: string; timestampMs: number; eventType: string }[] = [];
  if (isTechnical) {
    snapshotRows = await db
      .select({
        code: codeSnapshots.code,
        language: codeSnapshots.language,
        timestampMs: codeSnapshots.timestampMs,
        eventType: codeSnapshots.eventType,
      })
      .from(codeSnapshots)
      .where(eq(codeSnapshots.sessionId, id))
      .orderBy(asc(codeSnapshots.timestampMs));
  }

  // Call Python service (behavioral or technical)
  const analysisEndpoint = isTechnical ? "analysis/technical" : "analysis/behavioral";
  const analysisBody = isTechnical
    ? {
        session_id: id,
        transcript: transcript.entries,
        code_snapshots: snapshotRows.map((s) => ({
          code: s.code,
          language: s.language,
          timestamp_ms: s.timestampMs,
          event_type: s.eventType,
        })),
        config: found.config,
      }
    : {
        session_id: id,
        transcript: transcript.entries,
        config: found.config,
      };

  let feedbackData;
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/${analysisEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysisBody),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      return NextResponse.json(
        { error: `Feedback generation failed: ${err.detail || res.statusText}` },
        { status: 502 }
      );
    }

    feedbackData = await res.json();
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not reach analysis service: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 502 }
    );
  }

  // Save to database
  const [saved] = await db
    .insert(sessionFeedback)
    .values({
      sessionId: id,
      overallScore: feedbackData.overall_score,
      summary: feedbackData.summary,
      strengths: feedbackData.strengths,
      weaknesses: feedbackData.weaknesses,
      answerAnalyses: feedbackData.answer_analyses,
      ...(isTechnical && {
        codeQualityScore: feedbackData.code_quality_score,
        explanationQualityScore: feedbackData.explanation_quality_score,
        timelineAnalysis: feedbackData.timeline_analysis,
      }),
    })
    .returning();

  return NextResponse.json(saved, { status: 201 });
}

// GET /api/sessions/[id]/feedback — get existing feedback
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  setSentryUser(session.user);

  // Verify session ownership
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

  const [feedback] = await db
    .select()
    .from(sessionFeedback)
    .where(eq(sessionFeedback.sessionId, id));

  if (!feedback) {
    return NextResponse.json(
      { error: "Feedback not yet generated" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ...feedback, type: found.type });
}
