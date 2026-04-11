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

describe("POST /api/users/badges (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
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
});
