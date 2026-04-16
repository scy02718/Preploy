import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../../tests/setup-db";
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

// Mock rate limiter to allow by default
const mockCheckRateLimit = vi.fn<() => NextResponse | null>(() => null);
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: () => mockCheckRateLimit(),
}));

// Mock OpenAI — use vi.hoisted so mockCreate is available when the factory runs
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { POST } from "./route";

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

const VALID_AI_RESPONSE = {
  persuasiveness_score: 78,
  persuasiveness_justification: "Compelling with concrete metrics.",
  star_alignment_score: 85,
  star_breakdown: {
    situation: 90,
    task: 80,
    action: 85,
    result: 85,
  },
  role_fit_score: 80,
  role_fit_justification: "Strong alignment with engineering leadership.",
  question_fit_score: 75,
  question_fit_justification: "Addresses leadership but could be more direct.",
  suggestions: [
    "Add specific numbers to Action section",
    "Clarify personal vs team contribution",
    "Quantify business impact in Result",
  ],
};

function makePostRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/star/${id}/analyze`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id }) },
  ];
}

describe("POST /api/star/[id]/analyze (integration)", () => {
  let storyId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null); // allow by default
    const db = getTestDb();
    await db.delete(starStoryAnalyses);
    await db.delete(starStories);

    const [story] = await db
      .insert(starStories)
      .values({ userId: TEST_USER.id, ...BASE_STORY })
      .returning();
    storyId = story.id;

    // Default: OpenAI returns valid response
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_AI_RESPONSE) } }],
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's story", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent story", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      ...makePostRequest("00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCheckRateLimit.mockReturnValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(429);
  });

  it("creates and returns an analysis on happy path", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.storyId).toBe(storyId);
    expect(data.model).toBeDefined();
  });

  it("persists the analysis in the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(201);
    const responseData = await res.json();

    const db = getTestDb();
    const [found] = await db
      .select()
      .from(starStoryAnalyses)
      .where(eq(starStoryAnalyses.id, responseData.id));
    expect(found).toBeDefined();
    expect(found.storyId).toBe(storyId);
    expect(found.suggestions).toBeDefined();
  });

  it("stores suggestions separately from scores", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(201);
    const data = await res.json();
    // suggestions stored separately, scores don't include suggestions
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(
      (data.scores as Record<string, unknown>).suggestions
    ).toBeUndefined();
  });

  it("returns 500 when AI returns malformed JSON after retries", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not valid json {{{" } }],
    });
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(500);
  });

  it("returns 500 when AI returns invalid schema after retries", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ completely: "wrong", schema: true }),
          },
        },
      ],
    });
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(...makePostRequest(storyId));
    expect(res.status).toBe(500);
  });
});
