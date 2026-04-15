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
} from "../../../../../../tests/setup-db";
import { users, marketerPosts, marketerDrafts } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { PATCH } from "./route";

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

function makeRequest(id: string, body: unknown) {
  const url = new URL(`http://localhost/api/admin/marketer/drafts/${id}`);
  return new NextRequest(url, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/admin/marketer/drafts/[id] (integration)", () => {
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
        externalId: "edit-test-post",
        subreddit: "cscareerquestions",
        title: "Test post",
        body: "Body text",
        permalink: "https://reddit.com/r/test/edit",
        postedAt: new Date(),
        classification: "prepare",
        summary: "Test summary",
      })
      .returning();

    const [draft] = await db
      .insert(marketerDrafts)
      .values({
        postId: post.id,
        intent: "prepare",
        reply: "Original reply text",
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
    const res = await PATCH(makeRequest(draftId, { reply: "New reply" }), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-admin user", async () => {
    mockAuth.mockResolvedValueOnce({ user: OTHER_USER });
    const res = await PATCH(makeRequest(draftId, { reply: "New reply" }), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing reply field", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await PATCH(makeRequest(draftId, {}), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty reply", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await PATCH(makeRequest(draftId, { reply: "" }), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent draft", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const res = await PATCH(
      makeRequest("00000000-0000-0000-0000-999999999999", { reply: "test" }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-999999999999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates reply and sets status to edited", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const newReply = "Updated reply text for testing";
    const res = await PATCH(makeRequest(draftId, { reply: newReply }), {
      params: Promise.resolve({ id: draftId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe(newReply);
    expect(data.status).toBe("edited");
  });

  it("persists edit in the database", async () => {
    mockAuth.mockResolvedValueOnce({ user: ADMIN_USER });
    const newReply = "Persisted reply text";
    await PATCH(makeRequest(draftId, { reply: newReply }), {
      params: Promise.resolve({ id: draftId }),
    });

    const db = getTestDb();
    const [row] = await db
      .select()
      .from(marketerDrafts)
      .where(eq(marketerDrafts.id, draftId));
    expect(row.reply).toBe(newReply);
    expect(row.status).toBe("edited");
    expect(row.reviewedBy).toBe(ADMIN_USER.id);
    expect(row.reviewedAt).not.toBeNull();
  });
});
