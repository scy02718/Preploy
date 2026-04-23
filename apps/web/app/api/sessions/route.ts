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
import { checkRateLimit, requireProFeature } from "@/lib/api-utils";
import { tryConsumeInterviewSlot } from "@/lib/usage";
import { getCurrentUserPlan } from "@/lib/user-plan";
import {
  getBehavioralPersona,
  DEFAULT_BEHAVIORAL_PERSONA_ID,
  applyProbeStyleCap,
} from "@/lib/personas";

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

  const { type, config, source_star_story_id, use_pro_analysis } = parsed.data;

  // Validate config based on interview type. For technical sessions the
  // parsed data (Zod strips unknown keys) becomes the resolved config so that
  // stray fields like `persona` never reach the DB. See #179.
  let parsedConfigData: Record<string, unknown> | undefined;
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
    // Capture the Zod-parsed output so unknown fields (e.g. `persona` on a
    // technical config) are stripped before persistence. The behavioral
    // persona-resolution block below will further enrich/override this.
    parsedConfigData = configResult.data as Record<string, unknown>;
  }

  // Pro gate for use_pro_analysis flag. Free users sending true get 400.
  if (use_pro_analysis === true) {
    const userPlan = await getCurrentUserPlan(session.user.id);
    if (userPlan !== "pro") {
      return NextResponse.json(
        { error: "use_pro_analysis_requires_pro_plan" },
        { status: 400 }
      );
    }
  }

  // Pro gate for resume-attached sessions. The config is free-form (the
  // top-level schema only enforces `record`), so a free user could POST
  // `{ config: { resume_text: "...", resume_id: "..." } }` and land a
  // resume-tailored interviewer system prompt via `lib/prompts.ts`. That
  // is the Resume feature via a different entry point — gate it as such.
  // Users without either field keep the current free behaviour.
  if (
    config &&
    typeof config === "object" &&
    ((config as Record<string, unknown>).resume_text ||
      (config as Record<string, unknown>).resume_id)
  ) {
    const gated = await requireProFeature(session.user.id, "resume");
    if (gated) return gated;
  }

  // Resolve focus_directive for behavioral sessions only (#183).
  // Normalize to a trimmed string; empty/whitespace counts as absent.
  // Non-empty requires Pro; empty is allowed for free users and keeps the
  // persisted config clean (no "" vs undefined drift).
  let focusDirective = "";
  if (type === "behavioral") {
    const rawFocus = (config as Record<string, unknown>)?.focus_directive;
    focusDirective = typeof rawFocus === "string" ? rawFocus.trim() : "";
    if (focusDirective.length > 0) {
      const gated = await requireProFeature(session.user.id, "custom_topic");
      if (gated) return gated;
    }
  }

  // Resolve probe_depth for behavioral sessions. Technical sessions are
  // explicitly untouched — follow-up pressure applies only to behavioral
  // sessions. See #178.
  // Technical sessions ignore probe_depth — follow-up pressure applies only
  // to behavioral sessions. See #178.
  let resolvedConfig = parsedConfigData ?? config ?? {};
  if (type === "behavioral") {
    const rawProbeDepth = config && typeof config === "object"
      ? (config as Record<string, unknown>).probe_depth
      : undefined;

    if (typeof rawProbeDepth === "number" && rawProbeDepth > 0) {
      // Non-zero probe_depth requires Pro
      const gated = await requireProFeature(session.user.id, "follow_up_probing");
      if (gated) return gated;
      // Value already validated by Zod — keep as-is
      resolvedConfig = { ...resolvedConfig, probe_depth: rawProbeDepth };
    } else if (rawProbeDepth === 0) {
      // Explicitly set to 0 — persist it (free users may send 0 explicitly)
      resolvedConfig = { ...resolvedConfig, probe_depth: 0 };
    } else {
      // probe_depth was omitted — apply server-side default based on plan
      const userPlan = await getCurrentUserPlan(session.user.id);
      resolvedConfig = {
        ...resolvedConfig,
        probe_depth: userPlan === "pro" ? 2 : 0,
      };
    }
  }

  // Resolve and gate persona for behavioral sessions. Unknown id → 400.
  // Pro-only persona from free user → 402. Always persist a persona id
  // (defaults to "default") so the feedback page has a deterministic value.
  // Technical sessions: if the client somehow sent config.persona, silently
  // ignore it — do NOT touch the technical branch. See #179.
  if (type === "behavioral") {
    const rawPersonaId = (resolvedConfig as Record<string, unknown>).persona;
    const personaId =
      typeof rawPersonaId === "string" ? rawPersonaId : DEFAULT_BEHAVIORAL_PERSONA_ID;
    const persona = getBehavioralPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
    }
    if (persona.proOnly) {
      const gate = await requireProFeature(session.user.id, "interviewer_personas");
      if (gate) return gate;
    }
    resolvedConfig = { ...resolvedConfig, persona: persona.id };

    // Apply probe_depth cap from persona.probeStyle (cap rule #179).
    // The cap is applied here before persistence — the prompt builder reads
    // the already-capped value and does NOT re-apply the cap.
    if (
      persona.probeStyle !== undefined &&
      typeof (resolvedConfig as Record<string, unknown>).probe_depth === "number"
    ) {
      resolvedConfig = {
        ...resolvedConfig,
        probe_depth: applyProbeStyleCap(
          (resolvedConfig as Record<string, unknown>).probe_depth as 0 | 1 | 2 | 3,
          persona.probeStyle
        ),
      };
    }
  }

  // Write focus_directive into resolvedConfig when non-empty; strip the key
  // entirely when empty/whitespace to avoid "" vs undefined drift in persisted JSONB.
  // parsedConfigData may already contain focus_directive (Zod accepts ""), so we
  // always delete it first and then re-add only when non-empty. See #183.
  // For technical sessions, focus_directive is not a supported field — always strip it.
  if (type === "behavioral") {
    if (focusDirective.length > 0) {
      resolvedConfig = { ...resolvedConfig, focus_directive: focusDirective };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { focus_directive: _fd, ...withoutFocus } = resolvedConfig as Record<string, unknown>;
      resolvedConfig = withoutFocus;
    }
  } else {
    // Strip focus_directive from technical sessions (not supported)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { focus_directive: _fd, ...withoutFocus } = resolvedConfig as Record<string, unknown>;
    resolvedConfig = withoutFocus;
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
          config: resolvedConfig,
          sourceStarStoryId: source_star_story_id ?? null,
          useProAnalysis: use_pro_analysis ?? false,
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
