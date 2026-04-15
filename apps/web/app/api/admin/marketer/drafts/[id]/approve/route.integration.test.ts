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
} from "../../../../../../../tests/setup-db";
import { users, marketerPosts, marketerDrafts } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { POST } from "./route";

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  name: "Admin User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other@example.com",
  name: "Other User",
};

function makeRequest(id: string) {
  return new NextRequest(
    `http://localhost/api/admin/marketer/drafts/${id}/approve`,
    { method: "POST" }
  );
}

describe("POST /api/admin/marketer/drafts/[id]/approve (integration)", () => {
  let draftId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values([ADMIN_USER, OTHER_USER]).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ADMIN_USER_IDS = ADMIN_USER.id;
    const { _resetAdminIdsCache } = await import("@/lib/admin-utils");
    _resetAdminIdsCache();

    const db = getTestDb();
    await db.delete(marketerDrafts);
    await db.delete(marketerPosts);

    const [post] = await db
      .insert(marketerPosts)
      .values({
        source: "reddit",
        externalId: "approve-test-post",
        subreddit: "cscareerquestions",
        title: "Approve test post",
        body: "Body",
        permalink: "https://reddit.com/r/test/approve",
        postedAt: new Date(),
        classification: "prepare",
        summary: "Summary",
      })
      .returning();

    const [draft] = await db
      .insert(marketerDrafts)
      .values({
        postId: post.id,
        intent: "prepare",
        reply: "Reply to approve",
        status: "pending",
      })
      .returning();

    draftId = draft.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(draftId), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-admin user", async () => {
    mockAuth.mockResolvedValueOnce({ user: OTHER_USER });
    const res = await POST(makeRequest(draftId), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent draft", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await POST(
      makeRequest("00000000-0000-0000-0000-999999999999"),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-999999999999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("marks draft as approved and returns 200", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await POST(makeRequest(draftId), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("approved");
    expect(data.reviewedBy).toBe(ADMIN_USER.id);
  });

  it("persists approval in the database", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    await POST(makeRequest(draftId), {
      params: Promise.resolve({ id: draftId }),
    });

    const db = getTestDb();
    const [row] = await db
      .select()
      .from(marketerDrafts)
      .where(eq(marketerDrafts.id, draftId));
    expect(row.status).toBe("approved");
    expect(row.reviewedBy).toBe(ADMIN_USER.id);
    expect(row.reviewedAt).not.toBeNull();
  });
});
