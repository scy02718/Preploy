import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  sessionFeedback,
  userAchievements,
} from "@/lib/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { calculateStreaks, buildHeatmap } from "@/lib/streaks";
import { BADGES } from "@/lib/badges";

// GET /api/users/stats — get user stats, streaks, heatmap, and badges
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch all completed session dates for streak/heatmap calculation
  const sessions = await db
    .select({
      createdAt: interviewSessions.createdAt,
      type: interviewSessions.type,
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

  // Streaks
  const { currentStreak, longestStreak } = calculateStreaks(sessionDates);

  // Heatmap (last 30 days)
  const heatmap = buildHeatmap(sessionDates, 30);

  // Total sessions
  const totalSessions = sessions.length;

  // Highest score
  const [scoreRow] = await db
    .select({ maxScore: sql<number>`max(${sessionFeedback.overallScore})` })
    .from(sessionFeedback)
    .innerJoin(
      interviewSessions,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(eq(interviewSessions.userId, userId));

  const highestScore = scoreRow?.maxScore ?? null;

  // Average score
  const [avgRow] = await db
    .select({ avgScore: sql<number>`avg(${sessionFeedback.overallScore})` })
    .from(sessionFeedback)
    .innerJoin(
      interviewSessions,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(eq(interviewSessions.userId, userId));

  const avgScore = avgRow?.avgScore ? Number(avgRow.avgScore) : null;

  // Session types completed
  const types = new Set(sessions.map((s) => s.type));

  // Earned badges
  const earned = await db
    .select({ badgeId: userAchievements.badgeId, earnedAt: userAchievements.earnedAt })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const earnedBadges = earned.map((e) => ({
    badgeId: e.badgeId,
    earnedAt: e.earnedAt,
    ...BADGES.find((b) => b.id === e.badgeId),
  }));

  return NextResponse.json({
    totalSessions,
    currentStreak,
    longestStreak,
    highestScore,
    avgScore,
    heatmap,
    badges: earnedBadges,
    hasCompletedBehavioral: types.has("behavioral"),
    hasCompletedTechnical: types.has("technical"),
  });
}
