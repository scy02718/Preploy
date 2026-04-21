import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../tests/setup-db";
import { users, interviewUsage, deletedUsage, interviewSessions, sessionFeedback } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import {
  carryForwardUsage,
  recordDeletedUsage,
  hashEmailMonth,
  currentMonth,
  currentFreePeriodStart,
  getProAnalysisUsage,
} from "./usage";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000050",
  email: "carry-test@example.com",
  name: "Carry Test",
};

describe("usage carry-forward (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(interviewUsage).where(eq(interviewUsage.userId, TEST_USER.id));
    const month = currentMonth();
    const hash = hashEmailMonth(TEST_USER.email, month);
    await db
      .delete(deletedUsage)
      .where(and(eq(deletedUsage.emailHash, hash), eq(deletedUsage.month, month)));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("carryForwardUsage seeds interview_usage when matching hash exists (S3)", async () => {
    const db = getTestDb();

    // Simulate deleted user's usage record
    await recordDeletedUsage(TEST_USER.email, 3);

    // Carry forward to a new user with same email
    await carryForwardUsage(TEST_USER.email, TEST_USER.id);

    // Verify interview_usage was seeded
    const periodStart = currentFreePeriodStart();
    const [row] = await db
      .select({ count: interviewUsage.count })
      .from(interviewUsage)
      .where(
        and(
          eq(interviewUsage.userId, TEST_USER.id),
          eq(interviewUsage.periodStart, periodStart)
        )
      );
    expect(row).toBeDefined();
    expect(row.count).toBe(3);
  });

  it("carryForwardUsage does nothing when no matching hash exists (S4)", async () => {
    const db = getTestDb();

    // No recordDeletedUsage call — fresh email
    await carryForwardUsage("brand-new@example.com", TEST_USER.id);

    // Verify no interview_usage row was created
    const periodStart = currentFreePeriodStart();
    const [row] = await db
      .select({ count: interviewUsage.count })
      .from(interviewUsage)
      .where(
        and(
          eq(interviewUsage.userId, TEST_USER.id),
          eq(interviewUsage.periodStart, periodStart)
        )
      );
    expect(row).toBeUndefined();
  });

  it("recordDeletedUsage is idempotent — second call updates the count", async () => {
    const db = getTestDb();
    const month = currentMonth();
    const hash = hashEmailMonth(TEST_USER.email, month);

    await recordDeletedUsage(TEST_USER.email, 2);
    await recordDeletedUsage(TEST_USER.email, 3);

    const [row] = await db
      .select({ usageCount: deletedUsage.usageCount })
      .from(deletedUsage)
      .where(and(eq(deletedUsage.emailHash, hash), eq(deletedUsage.month, month)));
    expect(row).toBeDefined();
    expect(row.usageCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getProAnalysisUsage (integration)
// ---------------------------------------------------------------------------

const PRO_ANALYSIS_USER = {
  id: "00000000-0000-0000-0000-000000000060",
  email: "pro-analysis@example.com",
  name: "Pro Analysis Test",
  plan: "pro" as const,
};

describe("getProAnalysisUsage (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(PRO_ANALYSIS_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    // Clean sessions and feedback between tests — keep the user row
    const db = getTestDb();
    await db.delete(sessionFeedback);
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, PRO_ANALYSIS_USER.id));
  });

  afterAll(async () => {
    // cleanupTestDb and teardownTestDb are called by the carry-forward suite
    // above — avoid double-teardown by only cleaning up if that suite hasn't
    // run. In practice both suites share the same afterAll cleanupTestDb call
    // from the carry-forward block, so we do nothing here to avoid a
    // "already ended" error from postgres.js.
  });

  it("getProAnalysisUsage returns 0 when user has no pro feedback rows", async () => {
    const { used, limit } = await getProAnalysisUsage(PRO_ANALYSIS_USER.id);
    expect(used).toBe(0);
    expect(limit).toBe(10); // PRO_ANALYSIS_MONTHLY_LIMIT
  });

  it("getProAnalysisUsage returns 3 after three pro feedback rows are inserted", async () => {
    const db = getTestDb();
    const periodStart = currentFreePeriodStart();

    // Seed 3 sessions with pro-tier feedback
    for (let i = 0; i < 3; i++) {
      const [session] = await db
        .insert(interviewSessions)
        .values({ userId: PRO_ANALYSIS_USER.id, type: "behavioral", config: {} })
        .returning();
      await db.insert(sessionFeedback).values({
        sessionId: session.id,
        analysisTier: "pro",
        createdAt: new Date(periodStart.getTime() + i * 1000), // within period
      });
    }

    const { used, limit } = await getProAnalysisUsage(PRO_ANALYSIS_USER.id);
    expect(used).toBe(3);
    expect(limit).toBe(10);
  });

  it("getProAnalysisUsage excludes rows from a prior period", async () => {
    const db = getTestDb();
    const periodStart = currentFreePeriodStart();

    // Seed 2 feedback rows in an old period (6 months ago)
    const oldPeriodStart = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 6, 1)
    );
    for (let i = 0; i < 2; i++) {
      const [session] = await db
        .insert(interviewSessions)
        .values({ userId: PRO_ANALYSIS_USER.id, type: "behavioral", config: {} })
        .returning();
      await db.insert(sessionFeedback).values({
        sessionId: session.id,
        analysisTier: "pro",
        createdAt: new Date(oldPeriodStart.getTime() + i * 1000),
      });
    }

    // Seed 1 row in the current period
    const [currentSession] = await db
      .insert(interviewSessions)
      .values({ userId: PRO_ANALYSIS_USER.id, type: "behavioral", config: {} })
      .returning();
    await db.insert(sessionFeedback).values({
      sessionId: currentSession.id,
      analysisTier: "pro",
      createdAt: new Date(periodStart.getTime() + 5000),
    });

    // Pass explicit periodStart = current month start → only count the 1 current row
    const { used } = await getProAnalysisUsage(PRO_ANALYSIS_USER.id, periodStart);
    expect(used).toBe(1);
  });
});
