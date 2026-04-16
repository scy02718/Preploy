import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../../tests/setup-db";
import { users, interviewSessions } from "@/lib/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000075",
  email: "cleanup-test@example.com",
  name: "Cleanup Test User",
};

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["authorization"] = `Bearer ${secret}`;
  return new NextRequest(
    "http://localhost:3000/api/admin/cron/cleanup-sessions",
    { method: "POST", headers }
  );
}

describe("POST /api/admin/cron/cleanup-sessions (integration)", () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db
      .delete(interviewSessions)
      .where(eq(interviewSessions.userId, TEST_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when no authorization header is present", async () => {
    const res = await POST(makeRequest());
    expect(res!.status).toBe(401);
  });

  it("returns 401 when the secret is wrong", async () => {
    const res = await POST(makeRequest("wrong-secret"));
    expect(res!.status).toBe(401);
  });

  it("does not touch an in_progress session started 1 minute ago", async () => {
    const db = getTestDb();
    const oneMinAgo = new Date(Date.now() - 60_000);
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "in_progress",
      startedAt: oneMinAgo,
      config: {},
    });

    const res = await POST(makeRequest("test-cron-secret"));
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.cleanedCount).toBe(0);

    const [session] = await db
      .select({ status: interviewSessions.status })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, TEST_USER.id));
    expect(session.status).toBe("in_progress");
  });

  it("flips an in_progress session older than 2h to failed with ended_at set", async () => {
    const db = getTestDb();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "in_progress",
      startedAt: threeHoursAgo,
      config: {},
    });

    const res = await POST(makeRequest("test-cron-secret"));
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.cleanedCount).toBe(1);

    const [session] = await db
      .select({
        status: interviewSessions.status,
        endedAt: interviewSessions.endedAt,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, TEST_USER.id));
    expect(session.status).toBe("failed");
    expect(session.endedAt).not.toBeNull();
  });

  it("does not touch a completed session older than 2h", async () => {
    const db = getTestDb();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "completed",
      startedAt: threeHoursAgo,
      endedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      config: {},
    });

    const res = await POST(makeRequest("test-cron-secret"));
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.cleanedCount).toBe(0);

    const [session] = await db
      .select({ status: interviewSessions.status })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, TEST_USER.id));
    expect(session.status).toBe("completed");
  });

  it("is idempotent — running twice produces the same result", async () => {
    const db = getTestDb();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db.insert(interviewSessions).values({
      userId: TEST_USER.id,
      type: "behavioral",
      status: "in_progress",
      startedAt: threeHoursAgo,
      config: {},
    });

    const res1 = await POST(makeRequest("test-cron-secret"));
    const data1 = await res1!.json();
    expect(data1.cleanedCount).toBe(1);

    const res2 = await POST(makeRequest("test-cron-secret"));
    const data2 = await res2!.json();
    expect(data2.cleanedCount).toBe(0);
  });
});
