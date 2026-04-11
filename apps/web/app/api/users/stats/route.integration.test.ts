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

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

describe("GET /api/users/stats (integration)", () => {
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
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns zero stats for user with no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    const data = await res.json();
    expect(data.totalSessions).toBe(0);
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(0);
    expect(data.badges).toEqual([]);
    expect(data.heatmap).toHaveLength(30);
  });

  it("returns correct total sessions and types", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "behavioral", status: "configuring", config: {} },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(data.totalSessions).toBe(2); // only completed
    expect(data.hasCompletedBehavioral).toBe(true);
    expect(data.hasCompletedTechnical).toBe(true);
  });

  it("returns earned badges", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.insert(userAchievements).values({
      userId: TEST_USER.id,
      badgeId: "first_interview",
    });

    const res = await GET();
    const data = await res.json();
    expect(data.badges).toHaveLength(1);
    expect(data.badges[0].badgeId).toBe("first_interview");
  });
});
