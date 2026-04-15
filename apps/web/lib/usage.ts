/**
 * Free-tier interview-usage tracking.
 *
 * Free users get FREE_PLAN_MONTHLY_INTERVIEW_LIMIT mock interviews per
 * calendar month. Pro users are unlimited and short-circuit out before
 * any DB read.
 *
 * Usage rows live in `interview_usage(user_id, period_start, count)` with
 * a unique index on `(user_id, period_start)` so the increment is a single
 * indexed UPSERT. Free users' period_start is `date_trunc('month', now())`;
 * old months naturally roll over because the new month produces a new
 * period_start key that doesn't match any existing row.
 */
import { sql } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewUsage } from "@/lib/schema";
import { FREE_PLAN_MONTHLY_INTERVIEW_LIMIT } from "@/lib/plans";
import { getCurrentUserPlan } from "@/lib/user-plan";

/**
 * Accepts the top-level `db` instance OR a transaction handle from
 * `db.transaction(async (tx) => ...)`. Both expose the same query API.
 * Using `typeof db` for the tx case is too narrow because Drizzle's
 * transaction type carries different generic parameters; we accept any
 * compatible client and rely on duck typing.
 */
type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The period-start key for the current user. For Free users this is the
 * first day of the current calendar month at UTC midnight. Using UTC keeps
 * the boundary stable across timezones — a user in Sydney crossing midnight
 * local time should not get a fresh quota until UTC also rolls over.
 */
export function currentFreePeriodStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

/** Returns the current period's used-interview count for the given user. */
export async function getCurrentPeriodUsage(userId: string): Promise<number> {
  const periodStart = currentFreePeriodStart();
  const [row] = await db
    .select({ count: interviewUsage.count })
    .from(interviewUsage)
    .where(
      and(
        eq(interviewUsage.userId, userId),
        eq(interviewUsage.periodStart, periodStart)
      )
    );
  return row?.count ?? 0;
}

/**
 * Returns true if the user is allowed to start another interview this period.
 * Pro users always allowed (short-circuit, no DB read).
 */
export async function isWithinFreeLimit(userId: string): Promise<boolean> {
  const plan = await getCurrentUserPlan(userId);
  if (plan === "pro") return true;
  const used = await getCurrentPeriodUsage(userId);
  return used < FREE_PLAN_MONTHLY_INTERVIEW_LIMIT;
}

/**
 * Atomically increments the current period's interview count.
 *
 * Accepts an optional transaction handle so callers (the session-creation
 * route) can run the increment in the same transaction as the session
 * insert. Without `tx`, runs in its own connection.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE to be both idempotent on first
 * insertion and safe under concurrent increments — Postgres serialises the
 * row-level lock on the unique index, so two simultaneous +1's both land.
 */
export async function incrementInterviewUsage(
  userId: string,
  txOrDb: DbOrTx = db
): Promise<void> {
  const periodStart = currentFreePeriodStart();
  await (txOrDb as typeof db)
    .insert(interviewUsage)
    .values({ userId, periodStart, count: 1 })
    .onConflictDoUpdate({
      target: [interviewUsage.userId, interviewUsage.periodStart],
      set: { count: sql`${interviewUsage.count} + 1` },
    });
}

/**
 * Read-and-bump used by interview-start endpoints. Returns the new count
 * if the slot was successfully consumed, or `allowed: false` if the user
 * is at the limit. Pro users always allowed (no counter touched).
 *
 * **Concurrency-safe** via a single atomic UPSERT with a guarded DO UPDATE:
 *
 *   INSERT INTO interview_usage (user_id, period_start, count)
 *   VALUES ($1, $2, 1)
 *   ON CONFLICT (user_id, period_start)
 *   DO UPDATE SET count = interview_usage.count + 1
 *     WHERE interview_usage.count < $limit
 *   RETURNING count;
 *
 * - Brand-new user → INSERT runs, returns count=1.
 * - User at count=2 (limit 3) → conflict, WHERE 2<3 passes, UPDATE to 3,
 *   returns count=3.
 * - User at count=3 → conflict, WHERE 3<3 fails, UPDATE skipped, RETURNING
 *   yields zero rows.
 *
 * Two parallel callers serialize on the row lock taken by the upsert; the
 * second one sees the first's commit and applies the WHERE against the
 * incremented value, so only one can ever cross the threshold.
 */
export async function tryConsumeInterviewSlot(
  userId: string,
  txOrDb: DbOrTx = db
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const plan = await getCurrentUserPlan(userId);
  if (plan === "pro") {
    return { allowed: true, used: 0, limit: null };
  }

  const periodStart = currentFreePeriodStart();
  const limit = FREE_PLAN_MONTHLY_INTERVIEW_LIMIT;

  const rows = await (txOrDb as typeof db)
    .insert(interviewUsage)
    .values({ userId, periodStart, count: 1 })
    .onConflictDoUpdate({
      target: [interviewUsage.userId, interviewUsage.periodStart],
      set: { count: sql`${interviewUsage.count} + 1` },
      setWhere: sql`${interviewUsage.count} < ${limit}`,
    })
    .returning({ count: interviewUsage.count });

  if (rows.length === 0) {
    // The conflict's WHERE filtered out the update — user is at or over
    // the limit. Re-read the actual count for the response body.
    const current = await getCurrentPeriodUsageWithDb(userId, txOrDb);
    return { allowed: false, used: current, limit };
  }

  return { allowed: true, used: rows[0].count, limit };
}

async function getCurrentPeriodUsageWithDb(
  userId: string,
  txOrDb: DbOrTx
): Promise<number> {
  const periodStart = currentFreePeriodStart();
  const [row] = await (txOrDb as typeof db)
    .select({ count: interviewUsage.count })
    .from(interviewUsage)
    .where(
      and(
        eq(interviewUsage.userId, userId),
        eq(interviewUsage.periodStart, periodStart)
      )
    );
  return row?.count ?? 0;
}
