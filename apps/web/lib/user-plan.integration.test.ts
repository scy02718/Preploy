import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { cleanupTestDb, teardownTestDb, getTestDb } from "../tests/setup-db";
import { users } from "@/lib/schema";

// Redirect db to the test database
import { vi } from "vitest";
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { getCurrentUserPlan } from "./user-plan";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";

describe("getCurrentUserPlan (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values([
      {
        id: TEST_USER_ID,
        email: "test@example.com",
        name: "Test User",
      },
      {
        id: OTHER_USER_ID,
        email: "other@example.com",
        name: "Other User",
        plan: "pro",
      },
    ]);
  });

  beforeEach(async () => {
    // Reset plan to free before each test
    const db = getTestDb();
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.id, TEST_USER_ID));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 'free' for a newly created user (default plan)", async () => {
    const plan = await getCurrentUserPlan(TEST_USER_ID);
    expect(plan).toBe("free");
  });

  it("returns 'free' for a non-existent user", async () => {
    const plan = await getCurrentUserPlan(
      "00000000-0000-0000-0000-000000000099"
    );
    expect(plan).toBe("free");
  });

  it("returns 'pro' after user plan is updated to pro", async () => {
    const db = getTestDb();
    await db
      .update(users)
      .set({ plan: "pro" })
      .where(eq(users.id, TEST_USER_ID));

    const plan = await getCurrentUserPlan(TEST_USER_ID);
    expect(plan).toBe("pro");
  });

  it("returns 'pro' for a user with plan 'max' (legacy tier coercion)", async () => {
    const db = getTestDb();
    await db
      .update(users)
      .set({ plan: "max" })
      .where(eq(users.id, TEST_USER_ID));

    const plan = await getCurrentUserPlan(TEST_USER_ID);
    expect(plan).toBe("pro");
  });

  it("reads the correct plan for each user independently", async () => {
    // TEST_USER_ID is free (reset by beforeEach), OTHER_USER_ID is pro (seeded)
    const [freePlan, proPlan] = await Promise.all([
      getCurrentUserPlan(TEST_USER_ID),
      getCurrentUserPlan(OTHER_USER_ID),
    ]);
    expect(freePlan).toBe("free");
    expect(proPlan).toBe("pro");
  });

  it("reflects plan change back to free", async () => {
    const db = getTestDb();
    // Set to pro first
    await db
      .update(users)
      .set({ plan: "pro" })
      .where(eq(users.id, TEST_USER_ID));
    expect(await getCurrentUserPlan(TEST_USER_ID)).toBe("pro");

    // Downgrade back to free
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.id, TEST_USER_ID));
    expect(await getCurrentUserPlan(TEST_USER_ID)).toBe("free");
  });
});
