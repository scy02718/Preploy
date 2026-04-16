import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviewSessions } from "@/lib/schema";
import { sql, eq, and, lt } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";

const DEFAULT_TIMEOUT_HOURS = 2;

/**
 * POST /api/admin/cron/cleanup-sessions
 *
 * Vercel Cron endpoint that marks interview sessions stuck in `in_progress`
 * as `failed` after a configurable timeout. Authorized via CRON_SECRET
 * bearer token, same pattern as the Reddit marketer cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit("cron-cleanup-sessions");
  if (rateLimitResult) return rateLimitResult;

  const log = createRequestLogger({
    route: "POST /api/admin/cron/cleanup-sessions",
    userId: "cron",
  });

  const timeoutHours =
    parseInt(process.env.ORPHANED_SESSION_TIMEOUT_HOURS ?? "", 10) ||
    DEFAULT_TIMEOUT_HOURS;

  try {
    const cutoff = sql`NOW() - make_interval(hours => ${timeoutHours})`;

    const cleaned = await db
      .update(interviewSessions)
      .set({
        status: "failed",
        endedAt: sql`${interviewSessions.startedAt} + make_interval(hours => ${timeoutHours})`,
      })
      .where(
        and(
          eq(interviewSessions.status, "in_progress"),
          lt(interviewSessions.startedAt, cutoff)
        )
      )
      .returning({ id: interviewSessions.id });

    log.info(
      { cleanedCount: cleaned.length, timeoutHours },
      "cleaned up orphaned sessions"
    );

    return NextResponse.json({
      cleanedCount: cleaned.length,
      cleanedIds: cleaned.map((r) => r.id),
    });
  } catch (err) {
    log.error({ err }, "failed to clean up orphaned sessions");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
