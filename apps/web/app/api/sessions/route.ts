import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, sessionFeedback, users, starStories } from "@/lib/schema";
import { and, desc, eq, gte, lte, sql, ne } from "drizzle-orm";
import { getPlanConfig, FREE_PLAN_MONTHLY_INTERVIEW_LIMIT } from "@/lib/plans";
import {
  createSessionSchema,
  behavioralConfigSchema,
  technicalConfigSchema,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/api-utils";
import { tryConsumeInterviewSlot } from "@/lib/usage";

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

  const rateLimited = await checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  // Check daily session limit based on user's plan
  const [user] = await db
    .select({ plan: users.plan, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (user?.disabledAt) {
    return NextResponse.json(
      { error: "Your account has been disabled. You cannot create new sessions." },
      { status: 403 }
    );
  }

  const plan = getPlanConfig(user?.plan);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: todayCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, session.user.id),
        gte(interviewSessions.createdAt, todayStart)
      )
    );

  if (Number(todayCount) >= plan.dailySessionLimit) {
    return NextResponse.json(
      {
        error: `Daily session limit reached (${plan.dailySessionLimit} sessions/day on ${plan.name} plan). Upgrade your plan for more sessions.`,
        plan: plan.id,
        limit: plan.dailySessionLimit,
        used: Number(todayCount),
      },
      { status: 429 }
    );
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

  const { type, config, source_star_story_id } = parsed.data;

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

  // Capture once so the transaction callback closure has a narrowed string
  // (TypeScript loses the `session.user.id` non-null narrowing across the
  // async boundary).
  const userId = session.user.id;

  // Validate source_star_story_id — must exist and belong to the requesting
  // user. Return 400 (not 404) to avoid leaking the existence of another
  // user's story.
  if (source_star_story_id) {
    const [story] = await db
      .select({ id: starStories.id, userId: starStories.userId })
      .from(starStories)
      .where(eq(starStories.id, source_star_story_id));

    if (!story || story.userId !== userId) {
      return NextResponse.json(
        { error: "Invalid source_star_story_id" },
        { status: 400 }
      );
    }
  }

  // Free-tier monthly limit gate. Pro users short-circuit out of the
  // counter entirely; free users at the limit get a 402 with a documented
  // body the client uses to trigger the upgrade dialog. The slot consume
  // and the session insert run in the same transaction so two parallel
  // requests at 2/3 cannot both succeed.
  try {
    const created = await db.transaction(async (tx) => {
      const slot = await tryConsumeInterviewSlot(userId, tx);
      if (!slot.allowed) {
        // Throwing rolls back the transaction (no usage row written, no
        // session row written). The catch below maps it to 402.
        const err = new Error("free_tier_limit_reached") as Error & {
          httpBody?: Record<string, unknown>;
        };
        err.httpBody = {
          error: "free_tier_limit_reached",
          limit: slot.limit ?? FREE_PLAN_MONTHLY_INTERVIEW_LIMIT,
          used: slot.used,
          plan: "free",
          upgradeUrl: "/api/billing/checkout",
        };
        throw err;
      }

      const [row] = await tx
        .insert(interviewSessions)
        .values({
          userId,
          type,
          config: config ?? {},
          sourceStarStoryId: source_star_story_id ?? null,
        })
        .returning();
      return row;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "free_tier_limit_reached") {
      const httpBody = (err as Error & { httpBody?: Record<string, unknown> })
        .httpBody;
      return NextResponse.json(httpBody ?? { error: err.message }, {
        status: 402,
      });
    }
    throw err;
  }
}
