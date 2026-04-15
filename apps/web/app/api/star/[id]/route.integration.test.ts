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
import { eq } from "drizzle-orm";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, starStories, starStoryAnalyses } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, PATCH, DELETE } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other@example.com",
  name: "Other User",
};

const BASE_STORY = {
  title: "Led microservices migration",
  role: "Senior Software Engineer",
  expectedQuestions: ["Tell me about a technical leadership challenge"],
  situation: "Our monolith caused 2-hour deploys.",
  task: "Design a 3-month migration plan.",
  action: "Broke system into 8 services.",
  result: "Deploy cycles dropped to 10 minutes.",
};

function makeRequest(
  method: string,
  id: string,
  body?: unknown
): [NextRequest, { params: Promise<{ id: string }> }] {
  if (body !== undefined) {
    return [
      new NextRequest(`http://localhost:3000/api/star/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    ];
  }
  return [
    new NextRequest(`http://localhost:3000/api/star/${id}`, { method }),
    { params: Promise.resolve({ id }) },
  ];
}

describe("GET /api/star/[id] (integration)", () => {
  let storyId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(starStoryAnalyses);
    await db.delete(starStories);

    const [story] = await db
      .insert(starStories)
      .values({ userId: TEST_USER.id, ...BASE_STORY })
      .returning();
    storyId = story.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(...makeRequest("GET", storyId));
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's story (no existence leak)", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await GET(...makeRequest("GET", storyId));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent story", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(
      ...makeRequest("GET", "00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(404);
  });

  it("returns story with empty analyses array on happy path", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(...makeRequest("GET", storyId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.story.id).toBe(storyId);
    expect(data.story.title).toBe(BASE_STORY.title);
    expect(data.analyses).toEqual([]);
  });

  it("returns analyses sorted newest first", async () => {
    const db = getTestDb();
    await db.insert(starStoryAnalyses).values([
      {
        storyId,
        scores: { persuasiveness_score: 70 },
        suggestions: ["Improve A"],
        model: "gpt-5.4-mini",
        createdAt: new Date("2026-04-01"),
      },
      {
        storyId,
        scores: { persuasiveness_score: 80 },
        suggestions: ["Improve B"],
        model: "gpt-5.4-mini",
        createdAt: new Date("2026-04-10"),
      },
    ]);

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(...makeRequest("GET", storyId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.analyses).toHaveLength(2);
    // Most recent first
    expect((data.analyses[0].scores as Record<string, number>).persuasiveness_score).toBe(80);
  });
});

describe("PATCH /api/star/[id] (integration)", () => {
  let storyId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(starStoryAnalyses);
    await db.delete(starStories);

    const [story] = await db
      .insert(starStories)
      .values({ userId: TEST_USER.id, ...BASE_STORY })
      .returning();
    storyId = story.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(...makeRequest("PATCH", storyId, { title: "Updated" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's story", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await PATCH(
      ...makeRequest("PATCH", storyId, { title: "Sneaky Update" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid data (title too long)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makeRequest("PATCH", storyId, { title: "x".repeat(201) })
    );
    expect(res.status).toBe(400);
  });

  it("updates title and returns updated story", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makeRequest("PATCH", storyId, { title: "New Title" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("New Title");
  });

  it("partial update: only updates provided fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makeRequest("PATCH", storyId, { role: "Staff Engineer" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("Staff Engineer");
    expect(data.title).toBe(BASE_STORY.title); // Unchanged
  });

  it("persists the update in the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    await PATCH(...makeRequest("PATCH", storyId, { result: "New result text" }));

    const db = getTestDb();
    const [found] = await db
      .select()
      .from(starStories)
      .where(eq(starStories.id, storyId));
    expect(found.result).toBe("New result text");
  });
});

describe("DELETE /api/star/[id] (integration)", () => {
  let storyId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(starStoryAnalyses);
    await db.delete(starStories);

    const [story] = await db
      .insert(starStories)
      .values({ userId: TEST_USER.id, ...BASE_STORY })
      .returning();
    storyId = story.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(...makeRequest("DELETE", storyId));
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's story", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await DELETE(...makeRequest("DELETE", storyId));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent story", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(
      ...makeRequest("DELETE", "00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(404);
  });

  it("deletes the story and returns success", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(...makeRequest("DELETE", storyId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("actually removes the story from the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    await DELETE(...makeRequest("DELETE", storyId));

    const db = getTestDb();
    const [found] = await db
      .select()
      .from(starStories)
      .where(eq(starStories.id, storyId));
    expect(found).toBeUndefined();
  });

  it("cascades deletion to analyses", async () => {
    const db = getTestDb();
    await db.insert(starStoryAnalyses).values({
      storyId,
      scores: { persuasiveness_score: 75 },
      suggestions: ["Improve A"],
      model: "gpt-5.4-mini",
    });

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    await DELETE(...makeRequest("DELETE", storyId));

    const analyses = await db
      .select()
      .from(starStoryAnalyses)
      .where(eq(starStoryAnalyses.storyId, storyId));
    expect(analyses).toHaveLength(0);
  });
});
