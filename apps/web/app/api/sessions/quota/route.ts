import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewSessions, users } from "@/lib/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { getPlanConfig } from "@/lib/plans";

// GET /api/sessions/quota — get daily session quota for the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, session.user.id));

  const plan = getPlanConfig(user?.plan);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, session.user.id),
        gte(interviewSessions.createdAt, todayStart)
      )
    );

  const used = Number(count);

  return NextResponse.json({
    plan: plan.id,
    planName: plan.name,
    used,
    limit: plan.dailySessionLimit,
    remaining: Math.max(0, plan.dailySessionLimit - used),
  });
}
