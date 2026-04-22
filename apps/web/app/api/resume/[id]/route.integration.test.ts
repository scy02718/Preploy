import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, userResumes } from "@/lib/schema";

// Use vi.hoisted so mockParseResume is available when vi.mock factories run
const { mockAuth, mockParseResume } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockParseResume: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock the resume parser for PATCH tests
vi.mock("@/lib/resume-parser", () => ({
  parseResume: mockParseResume,
}));

import { DELETE, PATCH } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000011",
  email: "test-delete-resume@example.com",
  name: "Delete Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000012",
  email: "other-delete-resume@example.com",
  name: "Other Delete User",
};

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/resume/${id}`, {
    method: "DELETE",
  });
}

function makePatchRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/resume/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const MOCK_STRUCTURED = {
  roles: [
    {
      company: "Acme",
      title: "Engineer",
      dates: "2020",
      bullets: [{ text: "Did stuff", impact_score: 5, has_quantified_metric: false }],
    },
  ],
  skills: ["TypeScript"],
};

describe("API DELETE /api/resume/[id] (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockParseResume.mockResolvedValue(MOCK_STRUCTURED);
    const db = getTestDb();
    await db.delete(userResumes);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // 117-A — Unauthenticated → 401
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(
      makeDeleteRequest("00000000-0000-0000-0000-000000000099"),
      makeParams("00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(401);
  });

  // 117-B — Another user's resume → 404 (no existence leak)
  it("returns 404 when accessing another user's resume", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const [otherResume] = await db
      .insert(userResumes)
      .values({
        userId: OTHER_USER.id,
        filename: "other.pdf",
        content: "other content",
      })
      .returning();

    const res = await DELETE(
      makeDeleteRequest(otherResume.id),
      makeParams(otherResume.id)
    );
    expect(res.status).toBe(404);

    // Confirm the row is still in the database (not deleted)
    const rows = await db
      .select()
      .from(userResumes)
      .where((await import("drizzle-orm")).eq(userResumes.id, otherResume.id));
    expect(rows).toHaveLength(1);
  });

  // 117-C — Nonexistent UUID → 404
  it("returns 404 for a nonexistent resume UUID", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(
      makeDeleteRequest("00000000-0000-0000-0000-000000009999"),
      makeParams("00000000-0000-0000-0000-000000009999")
    );
    expect(res.status).toBe(404);
  });

  // 117-D — Malformed UUID → 404 (not 500)
  it("returns 404 for a malformed UUID (not 500)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(
      makeDeleteRequest("not-a-valid-uuid"),
      makeParams("not-a-valid-uuid")
    );
    expect(res.status).toBe(404);
  });

  // 117-E — Happy path → 204 + row gone
  it("returns 204 and deletes the resume on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "my-resume.pdf",
        content: "my resume content",
      })
      .returning();

    const res = await DELETE(
      makeDeleteRequest(resume.id),
      makeParams(resume.id)
    );
    expect(res.status).toBe(204);

    // Verify the row is gone
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(userResumes)
      .where(eq(userResumes.id, resume.id));
    expect(rows).toHaveLength(0);
  });
});

describe("API PATCH /api/resume/[id] (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockParseResume.mockResolvedValue(MOCK_STRUCTURED);
    const db = getTestDb();
    await db.delete(userResumes);
  });

  afterAll(async () => {
    // shared teardown with DELETE suite — only teardown once at the very end
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(
      makePatchRequest("00000000-0000-0000-0000-000000000099", {
        oldBullet: "old",
        newBullet: "new",
      }),
      makeParams("00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when accessing another user's resume", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const [otherResume] = await db
      .insert(userResumes)
      .values({ userId: OTHER_USER.id, filename: "other.txt", content: "old bullet here" })
      .returning();

    const res = await PATCH(
      makePatchRequest(otherResume.id, { oldBullet: "old bullet here", newBullet: "new bullet" }),
      makeParams(otherResume.id)
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent resume UUID", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      makePatchRequest("00000000-0000-0000-0000-000000009999", {
        oldBullet: "old",
        newBullet: "new",
      }),
      makeParams("00000000-0000-0000-0000-000000009999")
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when oldBullet is not found in resume content", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "resume.txt",
        content: "Led team of engineers to deliver product on time",
      })
      .returning();

    const res = await PATCH(
      makePatchRequest(resume.id, {
        oldBullet: "this bullet does not exist in content",
        newBullet: "new improved bullet",
      }),
      makeParams(resume.id)
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Bullet not found");
  });

  it("happy path: replaces bullet and persists new content + structured_data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const oldBullet = "Participated in team meetings and discussions";
    const newBullet = "Led 12 cross-functional team meetings, cutting decision time by 30%";
    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "resume.txt",
        content: `Engineer at Acme\n${oldBullet}`,
      })
      .returning();

    const res = await PATCH(
      makePatchRequest(resume.id, { oldBullet, newBullet }),
      makeParams(resume.id)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toContain(newBullet);
    expect(data.content).not.toContain(oldBullet);
    expect(data.structuredData).not.toBeNull();

    // Verify persistence via SELECT
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(userResumes).where(eq(userResumes.id, resume.id));
    expect(row.content).toContain(newBullet);
    expect(row.structuredData).not.toBeNull();
  });

  it("graceful-fallback: persists new content with structuredData null when parser throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockParseResume.mockRejectedValue(new Error("Parse failure"));

    const db = getTestDb();
    const oldBullet = "Did some work at the company";
    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "resume.txt",
        content: `Jane Smith\n${oldBullet}`,
      })
      .returning();

    const newBullet = "Delivered 3 product features reducing churn by 15%";
    const res = await PATCH(
      makePatchRequest(resume.id, { oldBullet, newBullet }),
      makeParams(resume.id)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toContain(newBullet);
    expect(data.structuredData).toBeNull();

    // Verify persistence
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(userResumes).where(eq(userResumes.id, resume.id));
    expect(row.content).toContain(newBullet);
    expect(row.structuredData).toBeNull();
  });
});
