import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, interviewSessions, sessionFeedback } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET } from "./route";

const FREE_USER = {
  id: "00000000-0000-0000-0000-000000000070",
  email: "free-analysis@example.com",
  name: "Free User",
  plan: "free" as const,
};

const PRO_USER = {
  id: "00000000-0000-0000-0000-000000000071",
  email: "pro-analysis-route@example.com",
  name: "Pro User",
  plan: "pro" as const,
};

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/users/pro-analysis-usage", {
    method: "GET",
  });
}

describe("GET /api/users/pro-analysis-usage (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(FREE_USER).onConflictDoNothing();
    await db.insert(users).values(PRO_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(sessionFeedback);
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, PRO_USER.id));
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, FREE_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("GET returns { plan: 'free', used: 0, limit: 0, periodEnd: null } for a Free user", async () => {
    mockAuth.mockResolvedValue({ user: { id: FREE_USER.id } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      plan: "free",
      used: 0,
      limit: 0,
      periodEnd: null,
    });
  });

  it("GET returns matching used/limit/periodEnd for a Pro user with 3 pro feedback rows", async () => {
    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });

    const db = getTestDb();
    const periodStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );

    // Seed 3 pro-tier feedback rows
    for (let i = 0; i < 3; i++) {
      const [session] = await db
        .insert(interviewSessions)
        .values({ userId: PRO_USER.id, type: "behavioral", config: {} })
        .returning();
      await db.insert(sessionFeedback).values({
        sessionId: session.id,
        analysisTier: "pro",
        createdAt: new Date(periodStart.getTime() + i * 1000),
      });
    }

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("pro");
    expect(body.used).toBe(3);
    expect(body.limit).toBe(10);
    // periodEnd is an ISO string or null
    expect(typeof body.periodEnd === "string" || body.periodEnd === null).toBe(true);
  });

  it("GET returns used: 0 for a Pro user with no feedback rows", async () => {
    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("pro");
    expect(body.used).toBe(0);
    expect(body.limit).toBe(10);
  });
});
