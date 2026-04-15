import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, interviewUsage } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000040",
  email: "usage-test@example.com",
  name: "Usage Test User",
};

describe("GET /api/usage/current (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(interviewUsage).where(eq(interviewUsage.userId, TEST_USER.id));
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.id, TEST_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns plan=free, used=0, limit=3 for a brand-new free user", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBe("free");
    expect(data.used).toBe(0);
    expect(data.limit).toBe(3);
  });

  it("returns the current period count for a free user with prior usage", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 2,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBe("free");
    expect(data.used).toBe(2);
    expect(data.limit).toBe(3);
  });

  it("returns plan=pro, used=0, limit=null for a pro user (counter not consulted)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    await db
      .update(users)
      .set({ plan: "pro" })
      .where(eq(users.id, TEST_USER.id));

    // Even with prior usage rows, pro users always see used=0 / limit=null
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 99,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBe("pro");
    expect(data.used).toBe(0);
    expect(data.limit).toBeNull();
  });

  it("ignores usage rows from other periods (calendar rollover)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    // Insert a usage row from January 2025 (well in the past)
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart: new Date(Date.UTC(2025, 0, 1)),
      count: 3,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    // Old-month row should be invisible — current period is empty
    expect(data.used).toBe(0);
  });
});
