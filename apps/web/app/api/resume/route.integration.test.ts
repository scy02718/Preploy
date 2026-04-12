import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../tests/setup-db";
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

import { GET } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test-resume@example.com",
  name: "Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other-resume@example.com",
  name: "Other User",
};

describe("API GET /api/resume (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(userResumes);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty array when user has no resumes", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resumes).toEqual([]);
  });

  it("returns user's resumes with correct shape", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(userResumes).values([
      { userId: TEST_USER.id, filename: "resume_a.pdf", content: "resume a content" },
      { userId: TEST_USER.id, filename: "resume_b.pdf", content: "resume b content" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resumes).toHaveLength(2);
    const filenames = data.resumes.map((r: { filename: string }) => r.filename);
    expect(filenames).toContain("resume_a.pdf");
    expect(filenames).toContain("resume_b.pdf");
    // Check shape
    expect(data.resumes[0].id).toBeDefined();
    expect(data.resumes[0].content).toBeDefined();
    expect(data.resumes[0].createdAt).toBeDefined();
  });

  it("does not return other user's resumes", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(userResumes).values({
      userId: OTHER_USER.id,
      filename: "other.pdf",
      content: "other user resume",
    });

    const res = await GET();
    const data = await res.json();
    expect(data.resumes).toEqual([]);
  });
});
