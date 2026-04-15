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
import { eq, count } from "drizzle-orm";

// Mock auth (not used by the cron endpoint, but imported modules may require it)
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

// Mock Reddit fetcher to avoid real HTTP calls
vi.mock("@/lib/marketer/reddit", () => ({
  fetchSubredditPosts: vi.fn(),
}));

// Mock OpenAI to avoid real API calls
// vi.hoisted ensures mockCreate is available before vi.mock hoisting
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            classification: "prepare",
            summary: "User wants interview prep help",
          }),
        },
      },
    ],
  });
  return { mockCreate };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

import { POST } from "./route";
import { fetchSubredditPosts } from "@/lib/marketer/reddit";

const CRON_SECRET = "test-cron-secret-12345";

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/admin/marketer/run", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

const sampleRedditPost = {
  id: "test-reddit-post-1",
  subreddit: "cscareerquestions",
  title: "How do I prepare for my Google interview?",
  selftext: "I have an interview in 3 weeks and I'm nervous.",
  permalink: "/r/cscareerquestions/comments/test1/how_do_i/",
  created_utc: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
};

describe("POST /api/admin/marketer/run (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db
      .insert(users)
      .values({
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@example.com",
        name: "Admin",
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    const db = getTestDb();
    await db.delete(marketerDrafts);
    await db.delete(marketerPosts);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when no Authorization header", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const res = await POST(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(401);
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("returns 200 with stats when authorized", async () => {
    vi.mocked(fetchSubredditPosts).mockResolvedValue([]);

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalFetched");
    expect(data).toHaveProperty("totalInserted");
    expect(data).toHaveProperty("totalDrafted");
    expect(data).toHaveProperty("errors");
  });

  it("inserts posts and drafts for fetched content", async () => {
    vi.mocked(fetchSubredditPosts).mockResolvedValue([sampleRedditPost]);

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalInserted).toBeGreaterThan(0);
    expect(data.totalDrafted).toBeGreaterThan(0);

    const db = getTestDb();
    const [{ total: postCount }] = await db
      .select({ total: count() })
      .from(marketerPosts);
    expect(postCount).toBeGreaterThan(0);

    const [{ total: draftCount }] = await db
      .select({ total: count() })
      .from(marketerDrafts);
    expect(draftCount).toBeGreaterThan(0);
  });

  it("is idempotent — running twice produces no duplicate marketer_posts rows", async () => {
    vi.mocked(fetchSubredditPosts).mockResolvedValue([sampleRedditPost]);

    // First run
    await POST(makeRequest(`Bearer ${CRON_SECRET}`));

    vi.mocked(fetchSubredditPosts).mockResolvedValue([sampleRedditPost]);

    // Second run
    const res2 = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    // Second run should insert 0 new posts (already exists)
    expect(data2.totalInserted).toBe(0);

    const db = getTestDb();
    const [{ total }] = await db
      .select({ total: count() })
      .from(marketerPosts)
      .where(eq(marketerPosts.externalId, sampleRedditPost.id));
    expect(total).toBe(1);
  });

  it("handles Reddit fetch failures gracefully and returns 200 with error count", async () => {
    vi.mocked(fetchSubredditPosts).mockRejectedValue(new Error("Network error"));

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("skips drafting for irrelevant posts", async () => {
    // Override the mockCreate to return irrelevant classification
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              classification: "irrelevant",
              summary: "Not relevant",
            }),
          },
        },
      ],
    });

    vi.mocked(fetchSubredditPosts).mockResolvedValue([sampleRedditPost]);

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    // irrelevant posts should have 0 drafts
    expect(data.totalDrafted).toBe(0);
    // But it should be inserted as a post (classification=irrelevant)
    expect(data.totalInserted).toBeGreaterThan(0);
  });
});
