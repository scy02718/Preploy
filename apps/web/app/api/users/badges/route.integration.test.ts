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
} from "../../../../tests/setup-db";
import { users, interviewSessions, userAchievements } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

// Distinct user for timezone tests — separate ID avoids conflicts with
// the beforeEach that deletes all sessions/achievements by TEST_USER.
const NZ_USER = {
  id: "00000000-0000-0000-0000-000000000201",
  email: "nz-user-badges@example.com",
  name: "NZ User",
  timezone: "Pacific/Auckland", // UTC+12/+13
};

describe("POST /api/users/badges (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(NZ_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(userAchievements);
    await db.delete(interviewSessions);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("awards first_interview badge after first completed session", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "completed",
      config: {},
    });

    const res = await POST();
    const data = await res.json();
    expect(data.awarded).toContain("first_interview");

    // Verify persisted in DB
    const rows = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, TEST_USER.id));
    expect(rows.some((r) => r.badgeId === "first_interview")).toBe(true);
  });

  it("does not re-award already earned badges", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "completed",
      config: {},
    });
    await db.insert(userAchievements).values({
      userId: TEST_USER.id,
      badgeId: "first_interview",
    });

    const res = await POST();
    const data = await res.json();
    expect(data.awarded).not.toContain("first_interview");
  });

  it("awards both_types when both interview types completed", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} },
    ]);

    const res = await POST();
    const data = await res.json();
    expect(data.awarded).toContain("both_types");
    expect(data.awarded).toContain("first_interview");
  });

  it("awards no badges for user with no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST();
    const data = await res.json();
    expect(data.awarded).toEqual([]);
  });

  // ---- Timezone-aware achievement tests ----

  it("early_bird is NOT awarded when the session is afternoon in the user's timezone", async () => {
    // 2026-04-21T02:00:00Z → 14:00 NZST (UTC+12) — afternoon, not the 5-6am window
    const db = getTestDb();
    await db.insert(interviewSessions).values({
      userId: NZ_USER.id,
      type: "behavioral",
      status: "completed",
      startedAt: new Date("2026-04-21T02:00:00Z"),
      createdAt: new Date("2026-04-21T02:00:00Z"),
    });

    mockAuth.mockResolvedValue({ user: { id: NZ_USER.id } });
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.awarded).not.toContain("early_bird");
  });

  it("early_bird IS awarded when the session is 6am in the user's timezone", async () => {
    // 2026-04-20T18:00:00Z → 06:00 NZST (UTC+12) — falls in the 5-7am window
    const db = getTestDb();
    await db.insert(interviewSessions).values({
      userId: NZ_USER.id,
      type: "behavioral",
      status: "completed",
      startedAt: new Date("2026-04-20T18:00:00Z"),
      createdAt: new Date("2026-04-20T18:00:00Z"),
    });

    mockAuth.mockResolvedValue({ user: { id: NZ_USER.id } });
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.awarded).toContain("early_bird");
  });

  it("marathon_runner uses the user's local calendar day, not UTC", async () => {
    // NZ is UTC+12. Sessions that straddle the UTC midnight boundary but all
    // land on April 21 in the NZ local calendar:
    //   2026-04-20T12:00:00Z → April 21 00:00 NZST (midnight)
    //   2026-04-20T23:00:00Z → April 21 11:00 NZST (mid-morning)
    // All 5 sessions belong to April 21 NZ — marathon_runner should fire.
    const db = getTestDb();
    const utcTimestamps = [
      "2026-04-20T12:00:00Z",
      "2026-04-20T14:00:00Z",
      "2026-04-20T16:00:00Z",
      "2026-04-20T20:00:00Z",
      "2026-04-20T23:00:00Z",
    ];

    for (const ts of utcTimestamps) {
      await db.insert(interviewSessions).values({
        userId: NZ_USER.id,
        type: "behavioral",
        status: "completed",
        startedAt: new Date(ts),
        createdAt: new Date(ts),
      });
    }

    // Freeze "now" to a moment still on April 21 NZ so sessionsToday matches
    vi.setSystemTime(new Date("2026-04-20T23:30:00Z")); // April 21 11:30 NZST

    mockAuth.mockResolvedValue({ user: { id: NZ_USER.id } });
    const res = await POST();

    vi.useRealTimers();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.awarded).toContain("marathon_runner");
  });
});
