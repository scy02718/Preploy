import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, users, gazeSamples } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { gazeSamplesBodySchema } from "@/lib/validations";

// POST /api/sessions/[id]/gaze-samples
// Ingests gaze sample data for a session.
// Only available when the user has gaze_tracking_enabled = true.
// Upserts — a second POST for the same session_id replaces the existing row.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({
    route: "POST /api/sessions/[id]/gaze-samples",
    userId,
  });

  // Verify session exists and belongs to this user (404 on ownership failure,
  // never 403 — don't leak that the session exists for another user).
  const [interviewSession] = await db
    .select({ id: interviewSessions.id, userId: interviewSessions.userId })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.userId, userId)
      )
    );

  if (!interviewSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Verify the user has gaze tracking enabled
  const [user] = await db
    .select({ gazeTrackingEnabled: users.gazeTrackingEnabled })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.gazeTrackingEnabled) {
    return NextResponse.json(
      { error: "Gaze & presence analysis is not enabled for your account" },
      { status: 403 }
    );
  }

  // Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = gazeSamplesBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  // Rate limit after validation (expensive DB write)
  await checkRateLimit(userId);

  const { samples } = parsed.data;

  // Upsert in a transaction to prevent duplicate rows from concurrent POSTs.
  const [inserted] = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: gazeSamples.id })
      .from(gazeSamples)
      .where(eq(gazeSamples.sessionId, sessionId));

    if (existing.length > 0) {
      await tx.delete(gazeSamples).where(eq(gazeSamples.sessionId, sessionId));
      log.info({ sessionId, sampleCount: samples.length }, "replacing existing gaze samples");
    }

    return tx
      .insert(gazeSamples)
      .values({ sessionId, samples })
      .returning({
        id: gazeSamples.id,
        sessionId: gazeSamples.sessionId,
        createdAt: gazeSamples.createdAt,
      });
  });

  log.info({ sessionId, sampleCount: samples.length }, "gaze samples saved");

  return NextResponse.json(inserted, { status: 201 });
}
