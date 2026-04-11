import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  interviewSessions,
  sessionFeedback,
  userAchievements,
} from "@/lib/schema";
import { and, desc, eq, sql } from "drizzle-orm";
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

  // Gather user stats
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
  const { currentStreak, longestStreak } = calculateStreaks(sessionDates);

  // Highest score
  const [scoreRow] = await db
    .select({ maxScore: sql<number>`max(${sessionFeedback.overallScore})` })
    .from(sessionFeedback)
    .innerJoin(
      interviewSessions,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(eq(interviewSessions.userId, userId));

  // Session types
  const types = new Set(sessions.map((s) => s.type));

  // Already earned
  const earned = await db
    .select({ badgeId: userAchievements.badgeId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const earnedBadgeIds = new Set(earned.map((e) => e.badgeId));

  // Check for new badges
  const newBadgeIds = checkNewBadges({
    totalSessions: sessions.length,
    currentStreak,
    longestStreak,
    highestScore: scoreRow?.maxScore ?? null,
    hasCompletedBehavioral: types.has("behavioral"),
    hasCompletedTechnical: types.has("technical"),
    earnedBadgeIds,
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
