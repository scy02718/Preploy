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
import { users, interviewUsage, deletedUsage } from "@/lib/schema";
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
