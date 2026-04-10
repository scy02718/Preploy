import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, codeSnapshots } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod/v4";

const snapshotSchema = z.object({
  code: z.string(),
  language: z.string().min(1),
  timestamp_ms: z.number().int().min(0),
  event_type: z.enum(["edit", "run", "submit"]),
});

const postBodySchema = z.object({
  snapshots: z.array(snapshotSchema).min(1),
});

// GET /api/sessions/[id]/snapshots — get all code snapshots for a session
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

  const snapshots = await db
    .select()
    .from(codeSnapshots)
    .where(eq(codeSnapshots.sessionId, id))
    .orderBy(asc(codeSnapshots.timestampMs));

  return NextResponse.json(snapshots);
}

// POST /api/sessions/[id]/snapshots — save code snapshots
export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const rows = parsed.data.snapshots.map((s) => ({
    sessionId: id,
    code: s.code,
    language: s.language,
    timestampMs: s.timestamp_ms,
    eventType: s.event_type as "edit" | "run" | "submit",
  }));

  const inserted = await db.insert(codeSnapshots).values(rows).returning();

  return NextResponse.json(inserted, { status: 201 });
}
