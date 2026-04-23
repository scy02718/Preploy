import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  transcripts,
  codeSnapshots,
  sessionFeedback,
  gazeSamples,
  starStories,
} from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import type { GazeSample } from "@/lib/gaze-types";
import {
  computeGazeConsistencyScore,
  computeGazeDistribution,
  computeCoverage,
  bucketSamplesForTimeline,
} from "@/lib/gaze-metrics";
import { setSentryUser, setSentryContext } from "@/lib/sentry-utils";
import { isTechnicalFeedbackComplete } from "@/lib/feedback-utils";
import { createRequestLogger } from "@/lib/logger";
import { runBehavioralAnalysis } from "@/lib/analysis-behavioral";
import { runTechnicalAnalysis } from "@/lib/analysis-technical";
import type {
  FeedbackResponse,
  TechnicalFeedbackResponse,
} from "@/lib/analysis-schemas";
import { OpenAIRetryError } from "@/lib/openai-retry";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { getProAnalysisUsage } from "@/lib/usage";
import type { AnalysisTier } from "@/lib/analysis-model";

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

  // Plan is read once per feedback request, not cached from session creation —
  // in-flight analyses finish at the tier the user has at the moment they hit
  // POST. Downgrade mid-session → Free output on this POST if the DB flip
  // landed first. Next session always uses the then-current tier.
  //
  // Tier is Pro iff ALL three conditions hold:
  //   1. User's current plan is "pro"
  //   2. Session was opted in to Pro analysis (useProAnalysis === true)
  //   3. User still has Pro-analysis quota remaining this period
  // Quota exhaustion falls through to Free silently — never 402.
  const plan = await getCurrentUserPlan(session.user.id);
  let tier: AnalysisTier = "free";
  if (plan === "pro" && found.useProAnalysis) {
    const { used, limit } = await getProAnalysisUsage(session.user.id);
    if (used < limit) {
      tier = "pro";
    } else {
      log.info(
        { userId: session.user.id, sessionId: id, proAnalysisFallback: true, used, limit },
        "Pro user opted into Pro analysis but is at quota — falling back to Free tier"
      );
    }
  }
  log.info({ tier, sessionId: id }, "feedback tier resolved");

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
    // Session ended before any transcript was recorded (e.g. user hit End Session
    // before the interviewer's first turn). Return a 200 "empty" sentinel so:
    //   1. The feedback page polling loop can break on a 200 (it only retries on 404).
    //   2. The client renders a friendly "nothing to score" card rather than spinning.
    // A 400 would be semantically wrong here — the session just never started.
    log.info({ sessionId: id }, "session has no transcript entries — returning empty sentinel");
    return NextResponse.json({ status: "empty" }, { status: 200 });
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

  // For behavioral sessions with a source STAR story, fetch the story for
  // drift analysis comparison.
  let preparedStory: { situation: string; task: string; action: string; result: string } | undefined;
  if (!isTechnical && found.sourceStarStoryId) {
    const [storyRow] = await db
      .select({
        situation: starStories.situation,
        task: starStories.task,
        action: starStories.action,
        result: starStories.result,
      })
      .from(starStories)
      .where(eq(starStories.id, found.sourceStarStoryId));

    if (storyRow) {
      preparedStory = storyRow;
      log.info({ sessionId: id, sourceStarStoryId: found.sourceStarStoryId }, "fetched source STAR story for drift analysis");
    }
  }

  // Call the local TS analysis pipeline directly (no HTTP hop). These are the
  // same functions the thin `/api/analysis/{behavioral,technical}` routes wrap.
  let feedbackData: FeedbackResponse | TechnicalFeedbackResponse;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcriptEntries = transcript.entries as any;
    if (isTechnical) {
      feedbackData = await runTechnicalAnalysis(
        {
          session_id: id,
          transcript: transcriptEntries,
          code_snapshots: snapshotRows.map((s) => ({
            code: s.code,
            language: s.language,
            timestamp_ms: s.timestampMs,
            event_type: s.eventType,
          })),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: (found.config ?? {}) as any,
        },
        { log, userId: session.user.id, tier },
      );
    } else {
      feedbackData = await runBehavioralAnalysis(
        {
          session_id: id,
          transcript: transcriptEntries,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: (found.config ?? {}) as any,
        },
        { log, userId: session.user.id, preparedStory, tier },
      );
    }
  } catch (err) {
    if (err instanceof OpenAIRetryError) {
      log.error(
        { reason: err.reason, sessionId: id },
        "analysis exhausted retries"
      );
      return NextResponse.json(
        { error: `Feedback generation failed: GPT response malformed (${err.reason})` },
        { status: 500 }
      );
    }
    log.error({ err, sessionId: id }, "analysis failed");
    return NextResponse.json(
      {
        error: `Feedback generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }

  // Compute gaze metrics if samples exist for this session
  const gazeRows = await db
    .select()
    .from(gazeSamples)
    .where(eq(gazeSamples.sessionId, id));

  let gazeConsistencyScore: number | null = null;
  let gazeDistribution = null;
  let gazeCoverage: number | null = null;
  let gazeTimeline = null;

  if (gazeRows.length > 0) {
    // Flatten all sample arrays from all gaze rows
    const allSamples: GazeSample[] = gazeRows.flatMap(
      (row) => (row.samples as GazeSample[]) ?? []
    );

    if (allSamples.length > 0) {
      // Estimate session duration from durationSeconds or from sample span
      const sessionDurationMs =
        found.durationSeconds != null && found.durationSeconds > 0
          ? found.durationSeconds * 1000
          : allSamples[allSamples.length - 1].t + 1000;

      gazeCoverage = computeCoverage(allSamples, sessionDurationMs);
      gazeConsistencyScore = computeGazeConsistencyScore(allSamples, sessionDurationMs);
      gazeDistribution = computeGazeDistribution(allSamples);
      gazeTimeline = bucketSamplesForTimeline(allSamples);

      log.info(
        { sessionId: id, sampleCount: allSamples.length, gazeCoverage, gazeConsistencyScore },
        "gaze metrics computed"
      );
    }
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
        codeQualityScore: (feedbackData as TechnicalFeedbackResponse).code_quality_score,
        explanationQualityScore: (feedbackData as TechnicalFeedbackResponse).explanation_quality_score,
        timelineAnalysis: (feedbackData as TechnicalFeedbackResponse).timeline_analysis,
      }),
      ...(!isTechnical && {
        driftAnalysis: (feedbackData as FeedbackResponse).drift_analysis ?? null,
      }),
      gazeConsistencyScore,
      gazeDistribution,
      gazeCoverage,
      gazeTimeline,
      analysisTier: tier,
    })
    .returning();

  // Fire-and-forget: send "feedback ready" email so the user gets pulled
  // back if they closed the tab after the session ended.
  const userEmail = session.user?.email;
  const userName = session.user?.name ?? null;
  if (userEmail) {
    import("@/lib/email/templates")
      .then(({ feedbackReadyEmail }) => {
        const { subject, html } = feedbackReadyEmail(
          userName,
          id,
          feedbackData.overall_score
        );
        return import("@/lib/email/send").then(({ sendEmail }) =>
          sendEmail({ to: userEmail, subject, html })
        );
      })
      .catch(() => {});
  }

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

  // Include config so the feedback page can read config.persona and other
  // session-level fields without a separate /api/sessions/:id round-trip.
  return NextResponse.json({ ...feedback, type: found.type, config: found.config });
}
