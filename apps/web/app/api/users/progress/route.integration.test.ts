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
import {
  users,
  interviewSessions,
  sessionFeedback,
} from "@/lib/schema";

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
  email: "progress-test@example.com",
  name: "Progress Test",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "other-progress@example.com",
  name: "Other User",
};

describe("GET /api/users/progress (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values([TEST_USER, OTHER_USER]).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(sessionFeedback);
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

  it("returns empty data for user with no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scoreTrend).toEqual([]);
    expect(data.averageByType).toEqual({});
    expect(data.weakAreas).toEqual([]);
    expect(data.monthComparison.thisMonth.sessions).toBe(0);
    expect(data.monthComparison.lastMonth.sessions).toBe(0);
  });

  it("returns score trend and averages with session data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    // Create completed sessions with feedback
    const [s1] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        status: "completed",
        config: {},
      })
      .returning();

    const [s2] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        status: "completed",
        config: {},
      })
      .returning();

    await db.insert(sessionFeedback).values([
      {
        sessionId: s1.id,
        overallScore: 7.5,
        summary: "Good job",
        strengths: ["Clear communication"],
        weaknesses: ["Lack of metrics", "Vague examples"],
      },
      {
        sessionId: s2.id,
        overallScore: 6.0,
        summary: "Decent",
        strengths: ["Good approach"],
        weaknesses: ["Lack of metrics", "Slow execution"],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    // Score trend
    expect(data.scoreTrend).toHaveLength(2);
    expect(data.scoreTrend[0]).toHaveProperty("date");
    expect(data.scoreTrend[0]).toHaveProperty("score");
    expect(data.scoreTrend[0]).toHaveProperty("type");

    // Average by type
    expect(data.averageByType.behavioral).toBe(7.5);
    expect(data.averageByType.technical).toBe(6);
  });

  it("returns weak areas sorted by frequency", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    // Create 3 sessions, "lack of metrics" appears in all 3
    const sessionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [s] = await db
        .insert(interviewSessions)
        .values({
          userId: TEST_USER.id,
          type: "behavioral",
          status: "completed",
          config: {},
        })
        .returning();
      sessionIds.push(s.id);
    }

    await db.insert(sessionFeedback).values([
      {
        sessionId: sessionIds[0],
        overallScore: 5,
        strengths: [],
        weaknesses: ["Lack of metrics", "Vague examples"],
      },
      {
        sessionId: sessionIds[1],
        overallScore: 6,
        strengths: [],
        weaknesses: ["Lack of metrics", "Poor structure"],
      },
      {
        sessionId: sessionIds[2],
        overallScore: 5.5,
        strengths: [],
        weaknesses: ["Lack of metrics"],
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.weakAreas.length).toBeGreaterThan(0);
    // "lack of metrics" should be first (appears 3 times)
    expect(data.weakAreas[0].topic).toBe("lack of metrics");
    expect(data.weakAreas[0].count).toBe(3);
    expect(data.weakAreas[0].total).toBe(3);
  });

  it("does not return other user's data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    // Other user's session
    const [s] = await db
      .insert(interviewSessions)
      .values({
        userId: OTHER_USER.id,
        type: "behavioral",
        status: "completed",
        config: {},
      })
      .returning();

    await db.insert(sessionFeedback).values({
      sessionId: s.id,
      overallScore: 9,
      strengths: ["Great"],
      weaknesses: ["None"],
    });

    const res = await GET();
    const data = await res.json();
    expect(data.scoreTrend).toEqual([]);
  });

  it("includes month comparison data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    const [s] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        status: "completed",
        config: {},
      })
      .returning();

    await db.insert(sessionFeedback).values({
      sessionId: s.id,
      overallScore: 8,
      strengths: [],
      weaknesses: [],
    });

    const res = await GET();
    const data = await res.json();

    expect(data.monthComparison).toBeDefined();
    expect(data.monthComparison.thisMonth).toHaveProperty("sessions");
    expect(data.monthComparison.thisMonth).toHaveProperty("avgScore");
    expect(data.monthComparison.lastMonth).toHaveProperty("sessions");
    expect(data.monthComparison.lastMonth).toHaveProperty("avgScore");
    // The session we just created should be in thisMonth
    expect(data.monthComparison.thisMonth.sessions).toBe(1);
    expect(data.monthComparison.thisMonth.avgScore).toBe(8);
  });
});
