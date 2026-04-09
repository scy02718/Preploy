import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  transcripts,
  sessionFeedback,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";

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

  // Check if feedback already exists
  const [existing] = await db
    .select()
    .from(sessionFeedback)
    .where(eq(sessionFeedback.sessionId, id));

  if (existing) {
    return NextResponse.json(existing);
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

  // Call Python service
  let feedbackData;
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/analysis/behavioral`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: id,
        transcript: transcript.entries,
        config: found.config,
      }),
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

  return NextResponse.json(feedback);
}
