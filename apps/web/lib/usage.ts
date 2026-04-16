/**
 * Monthly interview-usage tracking for BOTH free and pro tiers.
 *
 * - Free users get FREE_PLAN_MONTHLY_INTERVIEW_LIMIT (3) interviews per
 *   calendar month.
 * - Pro users get PRO_PLAN_MONTHLY_INTERVIEW_LIMIT (40) interviews per
 *   calendar month. The monthly cap is the primary cost gate.
 * - If a plan has `monthlyInterviews: null` in `PLAN_DEFINITIONS`, that
 *   plan is treated as truly unlimited (short-circuit, no DB read). Not
 *   currently used by any plan — kept as an escape hatch for a future
 *   "Enterprise" tier.
 *
 * Usage rows live in `interview_usage(user_id, period_start, count)` with
 * a unique index on `(user_id, period_start)` so the increment is a single
 * indexed UPSERT. `period_start` is `date_trunc('month', now())` in UTC;
 * old months naturally roll over because the new month produces a new
 * period_start key that doesn't match any existing row.
 */
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewUsage, deletedUsage } from "@/lib/schema";
import { getPlanLimits } from "@/lib/plans";
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
 * Applies the user's plan-specific monthly limit; returns true unconditionally
 * for plans with `monthlyInterviews: null` (truly unlimited, not currently
 * any tier).
 */
export async function isWithinMonthlyLimit(userId: string): Promise<boolean> {
  const plan = await getCurrentUserPlan(userId);
  const limit = getPlanLimits(plan).monthlyInterviews;
  if (limit === null) return true;
  const used = await getCurrentPeriodUsage(userId);
  return used < limit;
}

/**
 * @deprecated Name is misleading now that Pro users also have a monthly cap.
 * Kept as an alias for backwards compatibility with any existing callers.
 * Prefer `isWithinMonthlyLimit`.
 */
export const isWithinFreeLimit = isWithinMonthlyLimit;

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
 * is at the limit. Applies the user's plan-specific monthly cap from
 * `PLAN_DEFINITIONS`.
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
 * - User at count=39 (pro, limit 40) → conflict, WHERE 39<40 passes, UPDATE
 *   to 40, returns count=40.
 * - User at count=40 → conflict, WHERE 40<40 fails, UPDATE skipped,
 *   RETURNING yields zero rows.
 *
 * Two parallel callers serialize on the row lock taken by the upsert; the
 * second one sees the first's commit and applies the WHERE against the
 * incremented value, so only one can ever cross the threshold.
 *
 * If the user's plan has `monthlyInterviews: null` (truly unlimited), the
 * function short-circuits and returns `{ allowed: true, used: 0, limit: null }`
 * without touching the counter.
 */
export async function tryConsumeInterviewSlot(
  userId: string,
  txOrDb: DbOrTx = db
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const plan = await getCurrentUserPlan(userId);
  const limit = getPlanLimits(plan).monthlyInterviews;
  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }

  const periodStart = currentFreePeriodStart();

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

  const newCount = rows[0].count;

  // Send a nudge email when a free-tier user hits their last free session
  // (e.g., 3/3). Fire-and-forget — never block session creation on email.
  // Only for free users, and only on the exact boundary (not every time).
  if (plan === "free" && newCount === limit) {
    // Need the user's email — dynamic import to avoid circular deps.
    import("@/lib/db")
      .then(({ db: localDb }) =>
        import("@/lib/schema").then(async ({ users }) => {
          const { eq } = await import("drizzle-orm");
          const [user] = await localDb
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, userId));
          if (user?.email) {
            const { freeTierLimitEmail } = await import("@/lib/email/templates");
            const { sendEmail } = await import("@/lib/email/send");
            const { subject, html } = freeTierLimitEmail(user.name, newCount, limit);
            await sendEmail({ to: user.email, subject, html });
          }
        })
      )
      .catch(() => {});
  }

  return { allowed: true, used: newCount, limit };
}

// ---------------------------------------------------------------------------
// Anti-abuse: carry forward usage across account deletion / re-creation
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of an email + month string. The month isolates each
 * billing period so a hash from January won't collide with February.
 * Uses SHA-256 — no raw PII stored.
 */
export function hashEmailMonth(email: string, month: string): string {
  return createHash("sha256")
    .update(`${email.toLowerCase().trim()}:${month}`)
    .digest("hex");
}

/** Returns "YYYY-MM" for the given date (UTC). */
export function currentMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Called inside the account-deletion transaction. Reads the user's current
 * month usage and persists it as a hashed record so re-creation doesn't
 * reset the quota.
 */
export async function recordDeletedUsage(
  email: string,
  usageCount: number,
  txOrDb: DbOrTx = db
): Promise<void> {
  if (usageCount <= 0) return; // nothing to carry forward
  const month = currentMonth();
  const emailHash = hashEmailMonth(email, month);
  await (txOrDb as typeof db)
    .insert(deletedUsage)
    .values({ emailHash, month, usageCount })
    .onConflictDoUpdate({
      target: [deletedUsage.emailHash, deletedUsage.month],
      set: { usageCount, deletedAt: new Date() },
    });
}

/**
 * Called from the NextAuth `createUser` event. If the new user's email
 * matches a deleted-usage record for the current month, seed their
 * interview_usage so they don't get a free quota reset.
 */
export async function carryForwardUsage(
  email: string,
  userId: string,
  txOrDb: DbOrTx = db
): Promise<void> {
  const month = currentMonth();
  const emailHash = hashEmailMonth(email, month);
  const [row] = await (txOrDb as typeof db)
    .select({ usageCount: deletedUsage.usageCount })
    .from(deletedUsage)
    .where(
      and(eq(deletedUsage.emailHash, emailHash), eq(deletedUsage.month, month))
    );
  if (!row || row.usageCount <= 0) return;

  const periodStart = currentFreePeriodStart();
  await (txOrDb as typeof db)
    .insert(interviewUsage)
    .values({ userId, periodStart, count: row.usageCount })
    .onConflictDoUpdate({
      target: [interviewUsage.userId, interviewUsage.periodStart],
      set: { count: sql`GREATEST(${interviewUsage.count}, ${row.usageCount})` },
    });
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
