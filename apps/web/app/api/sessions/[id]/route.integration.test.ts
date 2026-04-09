import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, interviewSessions, sessionFeedback, transcripts } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, PATCH } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "test2@example.com",
  name: "Test User 2",
};

let testSessionId: string;

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/sessions/${testSessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API /api/sessions/[id] (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(sessionFeedback);
    await db.delete(transcripts);
    await db.delete(interviewSessions);

    // Create a session for each test
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        config: { interview_style: 0.5, difficulty: 0.5 },
      })
      .returning();
    testSessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  const makeParams = () => Promise.resolve({ id: testSessionId });

  // ---- GET ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest(`http://localhost:3000/api/sessions/${testSessionId}`);
    const res = await GET(req, { params: makeParams() });
    expect(res.status).toBe(401);
  });

  it("GET returns the session for the owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const req = new NextRequest(`http://localhost:3000/api/sessions/${testSessionId}`);
    const res = await GET(req, { params: makeParams() });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(testSessionId);
    expect(data.type).toBe("behavioral");
  });

  it("GET returns 404 for non-existent session", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const req = new NextRequest(`http://localhost:3000/api/sessions/${fakeId}`);
    const res = await GET(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });

  it("GET returns 404 for another user's session", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const req = new NextRequest(`http://localhost:3000/api/sessions/${testSessionId}`);
    const res = await GET(req, { params: makeParams() });
    expect(res.status).toBe(404);
  });

  // ---- PATCH ----

  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ status: "in_progress" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(401);
  });

  it("PATCH updates status and returns 200", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ status: "in_progress" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("in_progress");
  });

  it("PATCH handles ISO string timestamps correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const now = new Date().toISOString();
    const res = await PATCH(
      makePatchRequest({ startedAt: now, status: "in_progress" }),
      { params: makeParams() }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.startedAt).toBeDefined();
    // Verify it's a valid date string (not "Invalid Date")
    expect(new Date(data.startedAt).toISOString()).toBeTruthy();
  });

  it("PATCH returns 400 when no valid fields provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ invalidField: "nope" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 for another user's session", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const res = await PATCH(makePatchRequest({ status: "completed" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(404);
  });
});
