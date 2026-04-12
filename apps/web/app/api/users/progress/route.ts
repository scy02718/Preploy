import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, sessionFeedback } from "@/lib/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";

// GET /api/users/progress — score trend, avg by type, weak areas, month comparison
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "GET /api/users/progress", userId });

  // Fetch last 30 completed sessions with their feedback
  const rows = await db
    .select({
      sessionId: interviewSessions.id,
      type: interviewSessions.type,
      createdAt: interviewSessions.createdAt,
      overallScore: sessionFeedback.overallScore,
      weaknesses: sessionFeedback.weaknesses,
    })
    .from(interviewSessions)
    .innerJoin(
      sessionFeedback,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed")
      )
    )
    .orderBy(desc(interviewSessions.createdAt))
    .limit(30);

  // Score trend (oldest first for charting)
  const scoreTrend = rows
    .filter((r) => r.overallScore != null)
    .reverse()
    .map((r) => ({
      date: r.createdAt.toISOString().split("T")[0],
      score: r.overallScore!,
      type: r.type,
    }));

  // Average by type
  const byType: Record<string, { total: number; count: number }> = {};
  for (const r of rows) {
    if (r.overallScore == null) continue;
    if (!byType[r.type]) byType[r.type] = { total: 0, count: 0 };
    byType[r.type].total += r.overallScore;
    byType[r.type].count += 1;
  }
  const averageByType: Record<string, number> = {};
  for (const [type, { total, count }] of Object.entries(byType)) {
    averageByType[type] = Math.round((total / count) * 10) / 10;
  }

  // Weak areas — recurring themes from feedback weaknesses
  const weaknessCounts: Record<string, number> = {};
  for (const r of rows) {
    const weaknesses = r.weaknesses as string[] | null;
    if (!Array.isArray(weaknesses)) continue;
    for (const w of weaknesses) {
      if (typeof w !== "string" || w.trim().length === 0) continue;
      // Normalize: lowercase, trim
      const key = w.trim().toLowerCase();
      weaknessCounts[key] = (weaknessCounts[key] || 0) + 1;
    }
  }
  const weakAreas = Object.entries(weaknessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count, total: rows.length }));

  // Month-over-month comparison
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Query this month's sessions count + avg
  const [thisMonthRow] = await db
    .select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${sessionFeedback.overallScore})`,
    })
    .from(interviewSessions)
    .innerJoin(
      sessionFeedback,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed"),
        sql`${interviewSessions.createdAt} >= ${thisMonthStart.toISOString()}`
      )
    );

  const [lastMonthRow] = await db
    .select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${sessionFeedback.overallScore})`,
    })
    .from(interviewSessions)
    .innerJoin(
      sessionFeedback,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed"),
        sql`${interviewSessions.createdAt} >= ${lastMonthStart.toISOString()}`,
        sql`${interviewSessions.createdAt} < ${thisMonthStart.toISOString()}`
      )
    );

  const monthComparison = {
    thisMonth: {
      sessions: Number(thisMonthRow?.count ?? 0),
      avgScore: thisMonthRow?.avgScore ? Math.round(Number(thisMonthRow.avgScore) * 10) / 10 : null,
    },
    lastMonth: {
      sessions: Number(lastMonthRow?.count ?? 0),
      avgScore: lastMonthRow?.avgScore ? Math.round(Number(lastMonthRow.avgScore) * 10) / 10 : null,
    },
  };

  log.info("Progress data fetched");

  return NextResponse.json({
    scoreTrend,
    averageByType,
    weakAreas,
    monthComparison,
  });
}
