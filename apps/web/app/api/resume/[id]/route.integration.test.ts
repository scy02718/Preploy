import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, userResumes } from "@/lib/schema";

// Mock auth
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

import { DELETE } from "./route";

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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("API DELETE /api/resume/[id] (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
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
