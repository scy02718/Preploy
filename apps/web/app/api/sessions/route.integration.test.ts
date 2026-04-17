import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../tests/setup-db";
import { users } from "@/lib/schema";

// Mock auth — the only mock. Everything else is real.
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/sessions");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("API /api/sessions (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    // Clean sessions and usage between tests but keep the user
    const db = getTestDb();
    const { interviewSessions, sessionFeedback, transcripts, interviewUsage } =
      await import("@/lib/schema");
    await db.delete(sessionFeedback);
    await db.delete(transcripts);
    await db.delete(interviewSessions);
    await db.delete(interviewUsage);
    // Reset plan to free between tests
    const { eq } = await import("drizzle-orm");
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.id, TEST_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- Auth tests ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(401);
  });

  // ---- POST success ----

  it("POST creates a behavioral session and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest({
        type: "behavioral",
        config: {
          interview_style: 0.5,
          difficulty: 0.7,
          company_name: "Google",
        },
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.type).toBe("behavioral");
    expect(data.status).toBe("configuring");
    expect(data.config).toMatchObject({
      interview_style: 0.5,
      difficulty: 0.7,
      company_name: "Google",
    });
  });

  it("POST creates a session without config", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.config).toEqual({});
  });

  // ---- POST validation errors ----

  it("POST returns 400 for invalid session type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makePostRequest({ type: "unknown" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request");
  });

  it("POST returns 400 for invalid behavioral config", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest({
        type: "behavioral",
        config: {
          interview_style: 5.0, // out of range
          difficulty: 0.5,
        },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid session config");
  });

  // ---- GET success ----

  it("GET returns paginated sessions for the authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Create two sessions and mark them as completed so they pass the filter
    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "technical", status: "in_progress", config: {} },
    ]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.pagination.totalCount).toBe(2);
    expect(data.pagination.page).toBe(1);
  });

  it("GET paginates correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    // Insert 3 completed sessions
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
    ]);

    const res = await GET(makeGetRequest({ page: "1", limit: "2" }));
    const data = await res.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.pagination.totalPages).toBe(2);
    expect(data.pagination.totalCount).toBe(3);

    const res2 = await GET(makeGetRequest({ page: "2", limit: "2" }));
    const data2 = await res2.json();
    expect(data2.sessions).toHaveLength(1);
  });

  it("GET filters by type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} },
    ]);

    const res = await GET(makeGetRequest({ type: "technical" }));
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].type).toBe("technical");
  });

  it("GET returns empty when user has no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toEqual([]);
    expect(data.pagination.totalCount).toBe(0);
  });

  it("GET excludes sessions with configuring status", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", status: "configuring", config: {} },
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} },
    ]);

    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe("completed");
  });

  it("GET filters by minScore", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions, sessionFeedback } = await import("@/lib/schema");

    const [s1] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    ).returning();
    const [s2] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    ).returning();

    await db.insert(sessionFeedback).values([
      { sessionId: s1.id, overallScore: 8.5 },
      { sessionId: s2.id, overallScore: 3.0 },
    ]);

    const res = await GET(makeGetRequest({ minScore: "7" }));
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].overallScore).toBe(8.5);
  });

  it("GET filters by maxScore", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions, sessionFeedback } = await import("@/lib/schema");

    const [s1] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    ).returning();
    const [s2] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} }
    ).returning();

    await db.insert(sessionFeedback).values([
      { sessionId: s1.id, overallScore: 2.0 },
      { sessionId: s2.id, overallScore: 9.0 },
    ]);

    const res = await GET(makeGetRequest({ maxScore: "4" }));
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].overallScore).toBe(2.0);
  });

  it("GET combines type and score filters", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions, sessionFeedback } = await import("@/lib/schema");

    const [s1] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} }
    ).returning();
    const [s2] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    ).returning();
    const [s3] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "technical", status: "completed", config: {} }
    ).returning();

    await db.insert(sessionFeedback).values([
      { sessionId: s1.id, overallScore: 8.0 },
      { sessionId: s2.id, overallScore: 9.0 },
      { sessionId: s3.id, overallScore: 3.0 },
    ]);

    // Only technical with score >= 7
    const res = await GET(makeGetRequest({ type: "technical", minScore: "7" }));
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].type).toBe("technical");
    expect(data.sessions[0].overallScore).toBe(8.0);
  });

  it("GET includes overallScore from LEFT JOIN", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions, sessionFeedback } = await import("@/lib/schema");

    const [s1] = await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    ).returning();
    // s2 has no feedback
    await db.insert(interviewSessions).values(
      { userId: TEST_USER.id, type: "behavioral", status: "completed", config: {} }
    );

    await db.insert(sessionFeedback).values({ sessionId: s1.id, overallScore: 7.5 });

    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.sessions).toHaveLength(2);
    // One has a score, one doesn't
    const scores = data.sessions.map((s: { overallScore: number | null }) => s.overallScore);
    expect(scores).toContain(7.5);
    expect(scores).toContain(null);
  });

  it("GET does not return another user's sessions", async () => {
    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id, type: "behavioral", status: "completed", config: {},
    });

    // Query as a different user
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.sessions).toEqual([]);
  });

  // ---- Daily session limit tests ----

  it("POST returns 429 when daily session limit is reached (free plan = 3)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");

    // Create 3 sessions (free plan limit)
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "behavioral", config: {} },
    ]);

    // 4th should be rejected
    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(429);

    const data = await res.json();
    expect(data.error).toMatch(/daily session limit/i);
    expect(data.plan).toBe("free");
    expect(data.limit).toBe(3);
  });

  it("POST allows sessions under the daily limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");

    // Create 2 sessions (under free plan limit of 3)
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "behavioral", config: {} },
    ]);

    // 3rd should succeed
    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);
  });

  // ---- Free-tier monthly limit (#38) ----

  it("POST returns 402 free_tier_limit_reached when monthly limit hit (free plan)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewUsage } = await import("@/lib/schema");
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );

    // Pre-seed the usage row at the limit (3/3)
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 3,
    });

    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe("free_tier_limit_reached");
    expect(data.limit).toBe(3);
    expect(data.used).toBe(3);
    expect(data.plan).toBe("free");
    expect(data.upgradeUrl).toBe("/api/billing/checkout");

    // No new session row was created — the transaction rolled back
    const { interviewSessions } = await import("@/lib/schema");
    const allSessions = await db.select().from(interviewSessions);
    expect(allSessions.length).toBe(0);
  });

  it("POST increments interview_usage on successful session creation", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewUsage } = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");

    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);

    // Usage row should now exist with count=1
    const [usage] = await db
      .select()
      .from(interviewUsage)
      .where(eq(interviewUsage.userId, TEST_USER.id));
    expect(usage).toBeDefined();
    expect(usage.count).toBe(1);
  });

  it("POST gates pro users at the 40-session monthly cap (not unlimited)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewUsage } = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");

    // Upgrade user to pro
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, TEST_USER.id));

    // Pro user at 39/40 → one more session allowed, then blocked
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 39,
    });

    // 40th interview should succeed
    const res1 = await POST(makePostRequest({ type: "behavioral" }));
    expect(res1.status).toBe(201);

    const [usage1] = await db
      .select()
      .from(interviewUsage)
      .where(eq(interviewUsage.userId, TEST_USER.id));
    expect(usage1.count).toBe(40);

    // 41st should be blocked with 402 and the new pro-tier limit in the body
    const res2 = await POST(makePostRequest({ type: "behavioral" }));
    expect(res2.status).toBe(402);
    const data = await res2.json();
    expect(data.error).toBe("free_tier_limit_reached");
    expect(data.limit).toBe(40);
    expect(data.used).toBe(40);
  });

  it("POST allows a pro user well below the 40-session cap", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, TEST_USER.id));

    // Fresh pro user, no prior usage — should succeed
    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);
  });

  it("POST treats a fresh calendar month as 1/3, not 4/3", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewUsage } = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");

    // Insert an OLD-month usage row at the limit
    const oldPeriodStart = new Date(Date.UTC(2025, 0, 1));
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart: oldPeriodStart,
      count: 3,
    });

    // New month should not see the old row
    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);

    // A fresh row for the current period should be inserted with count=1
    const currentPeriodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );
    const [currentUsage] = await db
      .select()
      .from(interviewUsage)
      .where(eq(interviewUsage.periodStart, currentPeriodStart));
    expect(currentUsage.count).toBe(1);
  });

  it("POST concurrent requests at 2/3 — exactly one succeeds, the other gets 402", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    const { interviewUsage } = await import("@/lib/schema");
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );

    // Pre-seed at 2/3
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 2,
    });

    const [resA, resB] = await Promise.all([
      POST(makePostRequest({ type: "behavioral" })),
      POST(makePostRequest({ type: "behavioral" })),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 402]);

    // Final usage should be exactly 3 (one increment)
    const { eq } = await import("drizzle-orm");
    const [finalUsage] = await db
      .select()
      .from(interviewUsage)
      .where(eq(interviewUsage.userId, TEST_USER.id));
    expect(finalUsage.count).toBe(3);
  });

  it("POST returns 403 when account is disabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Disable the account
    const db = getTestDb();
    const { users } = await import("@/lib/schema");
    await db.update(users).set({ disabledAt: new Date() }).where(
      (await import("drizzle-orm")).eq(users.id, TEST_USER.id)
    );

    const res = await POST(makePostRequest({ type: "behavioral" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/disabled/i);

    // Reset
    await db.update(users).set({ disabledAt: null }).where(
      (await import("drizzle-orm")).eq(users.id, TEST_USER.id)
    );
  });

  // 123-J: Create technical session with "other" + additional_instructions — 201 + persisted JSONB
  it("POST creates technical session with 'other' sentinel and persists both focus_areas and additional_instructions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest({
        type: "technical",
        config: {
          interview_type: "leetcode",
          focus_areas: ["arrays", "other"],
          language: "python",
          difficulty: "medium",
          additional_instructions: "Other focus area: GPU shaders",
        },
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.type).toBe("technical");

    // Verify the JSONB config was persisted correctly in the DB
    const db = getTestDb();
    const { interviewSessions } = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, data.id));

    expect(row).toBeDefined();
    const config = row.config as Record<string, unknown>;
    expect((config.focus_areas as string[])).toContain("other");
    expect(config.additional_instructions).toBe("Other focus area: GPU shaders");
  });

  // 123-K: additional_instructions > 1000 chars → 400
  it("POST returns 400 when additional_instructions exceeds 1000 chars", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest({
        type: "technical",
        config: {
          interview_type: "leetcode",
          focus_areas: ["arrays"],
          language: "python",
          difficulty: "medium",
          additional_instructions: "x".repeat(1001),
        },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid session config");
  });
});
