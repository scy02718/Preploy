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
import { users, interviewSessions, transcripts } from "@/lib/schema";
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

function makePostRequest(sessionId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/transcript`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeGetRequest(sessionId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/transcript`,
    { method: "GET" }
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const SAMPLE_ENTRIES = [
  { speaker: "user", text: "I would use a hash map", timestamp_ms: 1000 },
  { speaker: "user", text: "The time complexity is O(n)", timestamp_ms: 5000 },
];

describe("API /api/sessions/[id]/transcript (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = getTestDb();
    await db.delete(transcripts);
    await db.delete(interviewSessions);

    // Create a fresh session owned by TEST_USER
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        config: {},
      })
      .returning();
    testSessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- POST tests ----

  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(
      makePostRequest(testSessionId, { entries: SAMPLE_ENTRIES }),
      makeParams(testSessionId)
    );
    expect(res.status).toBe(401);
  });

  it("POST returns 404 when session belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const res = await POST(
      makePostRequest(testSessionId, { entries: SAMPLE_ENTRIES }),
      makeParams(testSessionId)
    );
    expect(res.status).toBe(404);
  });

  it("POST returns 400 when entries is empty array", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest(testSessionId, { entries: [] }),
      makeParams(testSessionId)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/entries/i);
  });

  it("POST returns 400 when entries field is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest(testSessionId, {}),
      makeParams(testSessionId)
    );
    expect(res.status).toBe(400);
  });

  it("POST 201 persists transcript and returns data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makePostRequest(testSessionId, { entries: SAMPLE_ENTRIES }),
      makeParams(testSessionId)
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.sessionId).toBe(testSessionId);
    expect(body.entries).toHaveLength(2);

    // Verify persisted in DB
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.sessionId, testSessionId));
    expect(row).toBeDefined();
    expect(row.entries).toHaveLength(2);
  });

  // ---- GET tests ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeGetRequest(testSessionId), makeParams(testSessionId));
    expect(res.status).toBe(401);
  });

  it("GET returns 404 when session belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const res = await GET(makeGetRequest(testSessionId), makeParams(testSessionId));
    expect(res.status).toBe(404);
  });

  it("GET returns 404 when transcript not yet saved", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await GET(makeGetRequest(testSessionId), makeParams(testSessionId));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("GET returns 200 with saved transcript entries", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed transcript
    const db = getTestDb();
    await db.insert(transcripts).values({
      sessionId: testSessionId,
      entries: SAMPLE_ENTRIES,
    });

    const res = await GET(makeGetRequest(testSessionId), makeParams(testSessionId));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessionId).toBe(testSessionId);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].text).toBe("I would use a hash map");
  });
});
