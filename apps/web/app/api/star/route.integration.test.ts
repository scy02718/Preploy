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
} from "../../../tests/setup-db";
import { users, starStories } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, POST } from "./route";

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

const VALID_STORY_BODY = {
  title: "Led microservices migration",
  role: "Senior Software Engineer",
  expectedQuestions: ["Tell me about a technical leadership challenge"],
  situation: "Our monolith caused 2-hour deploys and was blocking 5 teams.",
  task: "I was tasked with designing a 3-month migration plan.",
  action: "I broke the system into 8 services and created migration runbooks.",
  result: "Deploy cycles dropped from 2 hours to 10 minutes.",
};

function makeGetRequest(queryParams = ""): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/star${queryParams ? `?${queryParams}` : ""}`
  );
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/star", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/star (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(starStories);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty stories array for user with no stories", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stories).toEqual([]);
    expect(data.pagination.total).toBe(0);
  });

  it("returns only the current user's stories", async () => {
    const db = getTestDb();
    await db.insert(starStories).values([
      {
        userId: TEST_USER.id,
        title: "My Story",
        role: "SWE",
        expectedQuestions: ["Question 1"],
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
      },
      {
        userId: OTHER_USER.id,
        title: "Other's Story",
        role: "PM",
        expectedQuestions: ["Question 2"],
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
      },
    ]);

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stories).toHaveLength(1);
    expect(data.stories[0].title).toBe("My Story");
  });

  it("returns paginated results with correct pagination metadata", async () => {
    const db = getTestDb();
    await db.insert(starStories).values(
      Array.from({ length: 5 }, (_, i) => ({
        userId: TEST_USER.id,
        title: `Story ${i + 1}`,
        role: "SWE",
        expectedQuestions: ["Q1"],
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
      }))
    );

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest("page=1&limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stories).toHaveLength(2);
    expect(data.pagination.total).toBe(5);
    expect(data.pagination.totalPages).toBe(3);
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(2);
  });

  it("returns second page of results", async () => {
    const db = getTestDb();
    await db.insert(starStories).values(
      Array.from({ length: 3 }, (_, i) => ({
        userId: TEST_USER.id,
        title: `Story ${i + 1}`,
        role: "SWE",
        expectedQuestions: ["Q1"],
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
      }))
    );

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest("page=2&limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stories).toHaveLength(1);
    expect(data.pagination.total).toBe(3);
  });

  it("returns 400 for invalid page parameter", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest("page=0"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/star (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(starStories);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_STORY_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest({ title: "Missing other fields" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty title", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makePostRequest({ ...VALID_STORY_BODY, title: "" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for too many expected questions (>3)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makePostRequest({
        ...VALID_STORY_BODY,
        expectedQuestions: ["Q1", "Q2", "Q3", "Q4"],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero expected questions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makePostRequest({ ...VALID_STORY_BODY, expectedQuestions: [] })
    );
    expect(res.status).toBe(400);
  });

  it("creates a story and returns 201 with story data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest(VALID_STORY_BODY));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe(VALID_STORY_BODY.title);
    expect(data.role).toBe(VALID_STORY_BODY.role);
    expect(data.userId).toBe(TEST_USER.id);
  });

  it("persists the created story in the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest(VALID_STORY_BODY));
    expect(res.status).toBe(201);
    const data = await res.json();

    const db = getTestDb();
    const [found] = await db
      .select()
      .from(starStories)
      .where(eq(starStories.id, data.id));
    expect(found).toBeDefined();
    expect(found.title).toBe(VALID_STORY_BODY.title);
    expect(found.situation).toBe(VALID_STORY_BODY.situation);
    expect(found.action).toBe(VALID_STORY_BODY.action);
  });

  it("accepts exactly 3 expected questions (maximum)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makePostRequest({
        ...VALID_STORY_BODY,
        expectedQuestions: ["Q1", "Q2", "Q3"],
      })
    );
    expect(res.status).toBe(201);
  });
});
