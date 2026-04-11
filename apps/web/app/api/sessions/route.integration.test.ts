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
    // Clean sessions between tests but keep the user
    const db = getTestDb();
    const { interviewSessions, sessionFeedback, transcripts } = await import(
      "@/lib/schema"
    );
    await db.delete(sessionFeedback);
    await db.delete(transcripts);
    await db.delete(interviewSessions);
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
});
