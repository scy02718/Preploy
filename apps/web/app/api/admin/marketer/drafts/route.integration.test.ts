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
import { users, marketerPosts, marketerDrafts } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));
vi.mock("@/lib/admin-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin-utils")>("@/lib/admin-utils");
  return actual;
});

import { GET } from "./route";

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

function makeRequest(searchParams?: Record<string, string>) {
  const url = new URL("http://localhost/api/admin/marketer/drafts");
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

describe("GET /api/admin/marketer/drafts (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values([ADMIN_USER, OTHER_USER]).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ADMIN_USER_IDS = ADMIN_USER.id;
    // Reset admin cache
    const { _resetAdminIdsCache } = await import("@/lib/admin-utils");
    _resetAdminIdsCache();
    // Clean marketer tables
    const db = getTestDb();
    await db.delete(marketerDrafts);
    await db.delete(marketerPosts);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-admin user", async () => {
    mockAuth.mockResolvedValueOnce({ user: OTHER_USER });
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid query params", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await GET(makeRequest({ page: "not-a-number" }));
    expect(res.status).toBe(400);
  });

  it("returns empty list when no pending drafts", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.drafts).toHaveLength(0);
    expect(data.pagination.total).toBe(0);
  });

  it("returns pending drafts with post info", async () => {
    const db = getTestDb();
    const [post] = await db
      .insert(marketerPosts)
      .values({
        source: "reddit",
        externalId: "test123",
        subreddit: "cscareerquestions",
        title: "How do I prepare?",
        body: "Test body",
        permalink: "https://reddit.com/r/test/comments/test123/",
        postedAt: new Date(),
        classification: "prepare",
        summary: "User wants prep tips",
      })
      .returning();

    await db.insert(marketerDrafts).values({
      postId: post.id,
      intent: "prepare",
      reply: "Here is my advice...",
      status: "pending",
    });

    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.drafts).toHaveLength(1);
    expect(data.drafts[0].intent).toBe("prepare");
    expect(data.drafts[0].post.title).toBe("How do I prepare?");
    expect(data.pagination.total).toBe(1);
  });

  it("excludes non-pending (approved/discarded) drafts", async () => {
    const db = getTestDb();
    const [post] = await db
      .insert(marketerPosts)
      .values({
        source: "reddit",
        externalId: "test456",
        subreddit: "leetcode",
        title: "Approved post",
        body: "Body",
        permalink: "https://reddit.com/r/test/456",
        postedAt: new Date(),
        classification: "prepare",
        summary: "Summary",
      })
      .returning();

    await db.insert(marketerDrafts).values([
      {
        postId: post.id,
        intent: "prepare",
        reply: "Approved reply",
        status: "approved",
      },
      {
        postId: post.id,
        intent: "prepare",
        reply: "Discarded reply",
        status: "discarded",
        discardReason: "spammy",
      },
    ]);

    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.drafts).toHaveLength(0);
    expect(data.pagination.total).toBe(0);
  });

  it("paginates correctly", async () => {
    const db = getTestDb();
    // Insert 3 posts and drafts
    for (let i = 0; i < 3; i++) {
      const [post] = await db
        .insert(marketerPosts)
        .values({
          source: "reddit",
          externalId: `paginate-${i}`,
          subreddit: "cscareerquestions",
          title: `Post ${i}`,
          body: "Body",
          permalink: `https://reddit.com/r/test/${i}`,
          postedAt: new Date(),
          classification: "prepare",
          summary: `Summary ${i}`,
        })
        .returning();

      await db.insert(marketerDrafts).values({
        postId: post.id,
        intent: "prepare",
        reply: `Reply ${i}`,
        status: "pending",
      });
    }

    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await GET(makeRequest({ page: "1", limit: "2" }));
    const data = await res.json();
    expect(data.drafts).toHaveLength(2);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.totalPages).toBe(2);

    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res2 = await GET(makeRequest({ page: "2", limit: "2" }));
    const data2 = await res2.json();
    expect(data2.drafts).toHaveLength(1);
  });
});
