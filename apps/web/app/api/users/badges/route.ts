import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  sessionFeedback,
  userAchievements,
  starStories,
  starStoryAnalyses,
  userResumes,
  interviewPlans,
  users,
} from "@/lib/schema";
import { and, desc, eq, sql, count as countFn } from "drizzle-orm";
import { calculateStreaks } from "@/lib/streaks";
import { checkNewBadges } from "@/lib/badge-checker";
import { createRequestLogger } from "@/lib/logger";

// POST /api/users/badges — check and award new badges for the authenticated user
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "POST /api/users/badges", userId });

  // Gather completed sessions with timestamps and types
  const sessions = await db
    .select({
      createdAt: interviewSessions.createdAt,
      type: interviewSessions.type,
      startedAt: interviewSessions.startedAt,
    })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed")
      )
    )
    .orderBy(desc(interviewSessions.createdAt));

  const sessionDates = sessions.map((s) => new Date(s.createdAt));
  const { currentStreak, longestStreak } = calculateStreaks(sessionDates);

  const behavioralSessions = sessions.filter((s) => s.type === "behavioral").length;
  const technicalSessions = sessions.filter((s) => s.type === "technical").length;
  const types = new Set(sessions.map((s) => s.type));

  // Scores: highest, average, count, comeback detection
  const scoreRows = await db
    .select({ score: sessionFeedback.overallScore })
    .from(sessionFeedback)
    .innerJoin(
      interviewSessions,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(
      and(
        eq(interviewSessions.userId, userId),
        sql`${sessionFeedback.overallScore} IS NOT NULL`
      )
    )
    .orderBy(desc(interviewSessions.createdAt));

  const scores = scoreRows
    .map((r) => r.score)
    .filter((s): s is number => s !== null);
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  // Comeback: any consecutive pair with 2+ point improvement
  let hasComeback = false;
  for (let i = 0; i < scores.length - 1; i++) {
    // scores are ordered newest-first, so scores[i+1] is the earlier session
    if (scores[i] - scores[i + 1] >= 2) {
      hasComeback = true;
      break;
    }
  }

  // STAR stories + analyzed count
  const [starRow] = await db
    .select({ count: countFn() })
    .from(starStories)
    .where(eq(starStories.userId, userId));

  const [analyzedRow] = await db
    .select({ count: sql<number>`count(DISTINCT ${starStoryAnalyses.storyId})` })
    .from(starStoryAnalyses)
    .innerJoin(starStories, eq(starStoryAnalyses.storyId, starStories.id))
    .where(eq(starStories.userId, userId));

  // Resume count
  const [resumeRow] = await db
    .select({ count: countFn() })
    .from(userResumes)
    .where(eq(userResumes.userId, userId));

  // Plan count
  const [planRow] = await db
    .select({ count: countFn() })
    .from(interviewPlans)
    .where(eq(interviewPlans.userId, userId));

  // Latest session hour (UTC)
  const latestSession = sessions[0];
  const latestSessionHour = latestSession?.startedAt
    ? new Date(latestSession.startedAt).getUTCHours()
    : latestSession?.createdAt
      ? new Date(latestSession.createdAt).getUTCHours()
      : null;

  // Sessions today (UTC)
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const sessionsToday = sessions.filter((s) => {
    const d = new Date(s.createdAt);
    const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return ds === todayStr;
  }).length;

  // User plan
  const [userRow] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId));

  // Already earned
  const earned = await db
    .select({ badgeId: userAchievements.badgeId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const earnedBadgeIds = new Set(earned.map((e) => e.badgeId));

  // Check for new badges
  const newBadgeIds = checkNewBadges({
    totalSessions: sessions.length,
    behavioralSessions,
    technicalSessions,
    currentStreak,
    longestStreak,
    highestScore,
    averageScore,
    scoredSessionCount: scores.length,
    hasCompletedBehavioral: types.has("behavioral"),
    hasCompletedTechnical: types.has("technical"),
    earnedBadgeIds,
    starStoryCount: Number(starRow?.count ?? 0),
    analyzedStarStoryCount: Number(analyzedRow?.count ?? 0),
    resumeCount: Number(resumeRow?.count ?? 0),
    planCount: Number(planRow?.count ?? 0),
    hasComeback,
    latestSessionHour,
    sessionsToday,
    plan: userRow?.plan ?? "free",
    hasProSession: (userRow?.plan === "pro" && sessions.length > 0),
  });

  // Award new badges
  if (newBadgeIds.length > 0) {
    await db.insert(userAchievements).values(
      newBadgeIds.map((badgeId) => ({
        userId,
        badgeId,
      }))
    );
    log.info({ newBadgeIds }, "Awarded new badges");
  }

  return NextResponse.json({ awarded: newBadgeIds });
}
