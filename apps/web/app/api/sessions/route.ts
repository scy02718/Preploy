import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

// GET /api/sessions — list sessions for a user
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.createdAt));

  return NextResponse.json(sessions);
}

// POST /api/sessions — create a new session
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, config } = body;

  if (!type || !["behavioral", "technical"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid interview type" },
      { status: 400 }
    );
  }

  const [session] = await db
    .insert(interviewSessions)
    .values({
      userId,
      type,
      config: config ?? {},
    })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
