import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// GET /api/sessions/[id] — get a single session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId))
    );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

// PATCH /api/sessions/[id] — update a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowedFields = [
    "status",
    "config",
    "startedAt",
    "endedAt",
    "durationSeconds",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [session] = await db
    .update(interviewSessions)
    .set(updates)
    .where(
      and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId))
    )
    .returning();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
