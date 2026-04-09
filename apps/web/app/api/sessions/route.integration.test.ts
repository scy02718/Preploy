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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ type: "behavioral" }));
    expect(res.status).toBe(401);
  });

  // ---- POST success ----

  it("POST creates a behavioral session and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makeRequest({
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

    const res = await POST(makeRequest({ type: "behavioral" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.config).toEqual({});
  });

  // ---- POST validation errors ----

  it("POST returns 400 for invalid session type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makeRequest({ type: "unknown" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request");
  });

  it("POST returns 400 for invalid behavioral config", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(
      makeRequest({
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

  it("GET returns sessions for the authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Create two sessions first
    await POST(makeRequest({ type: "behavioral" }));
    await POST(
      makeRequest({
        type: "behavioral",
        config: { interview_style: 0.8, difficulty: 0.3 },
      })
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("GET returns empty array when user has no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("GET does not return another user's sessions", async () => {
    // Create a session as TEST_USER
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    await POST(makeRequest({ type: "behavioral" }));

    // Query as a different user
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual([]);
  });
});
