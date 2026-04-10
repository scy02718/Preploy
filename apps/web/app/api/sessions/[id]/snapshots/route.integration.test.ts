import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../../tests/setup-db";
import { users, interviewSessions, codeSnapshots } from "@/lib/schema";
import { eq } from "drizzle-orm";

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

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other@example.com",
  name: "Other User",
};

let testSessionId: string;

function makePostRequest(
  sessionId: string,
  body: unknown
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/snapshots`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeGetRequest(sessionId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/snapshots`,
    { method: "GET" }
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("API /api/sessions/[id]/snapshots (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(codeSnapshots);
    await db.delete(interviewSessions);

    // Create a fresh test session
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        config: { interview_type: "leetcode", focus_areas: ["arrays"] },
      })
      .returning();
    testSessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- POST tests ----

  it("POST returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const request = makePostRequest(testSessionId, {
      snapshots: [
        { code: "print('hi')", language: "python", timestamp_ms: 0, event_type: "edit" },
      ],
    });

    const response = await POST(request, makeParams(testSessionId));
    expect(response.status).toBe(401);
  });

  it("POST returns 404 for session owned by another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const request = makePostRequest(testSessionId, {
      snapshots: [
        { code: "print('hi')", language: "python", timestamp_ms: 0, event_type: "edit" },
      ],
    });

    const response = await POST(request, makeParams(testSessionId));
    expect(response.status).toBe(404);
  });

  it("POST returns 400 for invalid body (empty snapshots array)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const request = makePostRequest(testSessionId, { snapshots: [] });
    const response = await POST(request, makeParams(testSessionId));
    expect(response.status).toBe(400);
  });

  it("POST returns 201 and persists snapshots to the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const snapshots = [
      { code: "def solution():\n    pass", language: "python", timestamp_ms: 0, event_type: "edit" as const },
      { code: "def solution():\n    return 1", language: "python", timestamp_ms: 5000, event_type: "edit" as const },
      { code: "def solution():\n    return sorted(nums)", language: "python", timestamp_ms: 12000, event_type: "edit" as const },
    ];

    const request = makePostRequest(testSessionId, { snapshots });
    const response = await POST(request, makeParams(testSessionId));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toHaveLength(3);
    expect(body[0].code).toBe("def solution():\n    pass");
    expect(body[0].sessionId).toBe(testSessionId);

    // Verify data is actually in the DB
    const db = getTestDb();
    const dbRows = await db
      .select()
      .from(codeSnapshots)
      .where(eq(codeSnapshots.sessionId, testSessionId));
    expect(dbRows).toHaveLength(3);
  });

  // ---- GET tests ----

  it("GET returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const request = makeGetRequest(testSessionId);
    const response = await GET(request, makeParams(testSessionId));
    expect(response.status).toBe(401);
  });

  it("GET returns snapshots ordered by timestamp_ms", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Insert snapshots out of order
    const db = getTestDb();
    await db.insert(codeSnapshots).values([
      { sessionId: testSessionId, code: "third", language: "python", timestampMs: 10000, eventType: "edit" },
      { sessionId: testSessionId, code: "first", language: "python", timestampMs: 0, eventType: "edit" },
      { sessionId: testSessionId, code: "second", language: "python", timestampMs: 5000, eventType: "edit" },
    ]);

    const request = makeGetRequest(testSessionId);
    const response = await GET(request, makeParams(testSessionId));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(3);
    expect(body[0].code).toBe("first");
    expect(body[1].code).toBe("second");
    expect(body[2].code).toBe("third");
    expect(body[0].timestampMs).toBeLessThan(body[1].timestampMs);
    expect(body[1].timestampMs).toBeLessThan(body[2].timestampMs);
  });

  it("GET returns empty array when session has no snapshots", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const request = makeGetRequest(testSessionId);
    const response = await GET(request, makeParams(testSessionId));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });
});
