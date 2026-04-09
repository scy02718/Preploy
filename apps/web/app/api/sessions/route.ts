import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import {
  createSessionSchema,
  behavioralConfigSchema,
  technicalConfigSchema,
} from "@/lib/validations";

// GET /api/sessions — list sessions for the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, session.user.id))
    .orderBy(desc(interviewSessions.createdAt));

  return NextResponse.json(sessions);
}

// POST /api/sessions — create a new session
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate top-level shape
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { type, config } = parsed.data;

  // Validate config based on interview type
  if (config) {
    const configSchema =
      type === "behavioral" ? behavioralConfigSchema : technicalConfigSchema;
    const configResult = configSchema.safeParse(config);
    if (!configResult.success) {
      return NextResponse.json(
        { error: "Invalid session config", details: configResult.error.issues },
        { status: 400 }
      );
    }
  }

  const [created] = await db
    .insert(interviewSessions)
    .values({
      userId: session.user.id,
      type,
      config: config ?? {},
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
