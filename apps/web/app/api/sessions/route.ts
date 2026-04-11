import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, sessionFeedback } from "@/lib/schema";
import { and, desc, eq, gte, lte, sql, ne } from "drizzle-orm";
import {
  createSessionSchema,
  behavioralConfigSchema,
  technicalConfigSchema,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/api-utils";

// GET /api/sessions — list sessions with pagination, type/score filters
// Query params: page (1-based), limit, type, minScore, maxScore
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));
  const offset = (page - 1) * limit;
  const typeFilter = searchParams.get("type"); // "behavioral" | "technical"
  const minScore = searchParams.get("minScore") ? parseFloat(searchParams.get("minScore")!) : null;
  const maxScore = searchParams.get("maxScore") ? parseFloat(searchParams.get("maxScore")!) : null;

  // Build WHERE conditions
  const conditions = [
    eq(interviewSessions.userId, session.user.id),
    ne(interviewSessions.status, "configuring"),
  ];
  if (typeFilter === "behavioral" || typeFilter === "technical") {
    conditions.push(eq(interviewSessions.type, typeFilter));
  }
  if (minScore !== null && !isNaN(minScore)) {
    conditions.push(gte(sessionFeedback.overallScore, minScore));
  }
  if (maxScore !== null && !isNaN(maxScore)) {
    conditions.push(lte(sessionFeedback.overallScore, maxScore));
  }

  // LEFT JOIN feedback to get scores in one query (eliminates N+1)
  const rows = await db
    .select({
      id: interviewSessions.id,
      type: interviewSessions.type,
      status: interviewSessions.status,
      config: interviewSessions.config,
      startedAt: interviewSessions.startedAt,
      endedAt: interviewSessions.endedAt,
      durationSeconds: interviewSessions.durationSeconds,
      createdAt: interviewSessions.createdAt,
      overallScore: sessionFeedback.overallScore,
    })
    .from(interviewSessions)
    .leftJoin(
      sessionFeedback,
      eq(interviewSessions.id, sessionFeedback.sessionId)
    )
    .where(and(...conditions))
    .orderBy(desc(interviewSessions.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total for pagination metadata (same filters, no limit/offset)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interviewSessions)
    .leftJoin(
      sessionFeedback,
      eq(interviewSessions.id, sessionFeedback.sessionId)
    )
    .where(and(...conditions));

  const totalCount = Number(count);

  return NextResponse.json({
    sessions: rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}

// POST /api/sessions — create a new session
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

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
