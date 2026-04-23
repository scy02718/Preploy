import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../../tests/setup-db";
import { users, interviewSessions } from "@/lib/schema";
import { eq } from "drizzle-orm";

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

// Mock OpenAI — same pattern as feedback route integration tests
const mockChatCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000010",
  email: "hint-test@example.com",
  name: "Hint Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000011",
  email: "hint-other@example.com",
  name: "Other User",
};

const PRO_USER = {
  id: "00000000-0000-0000-0000-000000000012",
  email: "hint-pro@example.com",
  name: "Pro User",
  plan: "pro" as const,
};

const VALID_BODY = {
  problemTitle: "Two Sum",
  problemDescription: "Return indices of two numbers that add up to a target.",
  code: "def two_sum(nums, target):\n    pass",
  language: "python",
};

function makePostRequest(sessionId: string, body: unknown = VALID_BODY): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/hints`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("API /api/sessions/[id]/hints (integration)", () => {
  beforeAll(async () => {
    vi.stubEnv("HINT_MODEL", "gpt-4o-mini");
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
    await db.insert(users).values(PRO_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(interviewSessions);
  });

  afterEach(() => {
    // don't unstub HINT_MODEL since we set it in beforeAll
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await cleanupTestDb();
    await teardownTestDb();
  });

  // 1. Unauth → 401
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({ userId: TEST_USER.id, type: "technical", config: {} })
      .returning();

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(401);
  });

  // 2. Foreign session → 404
  it("returns 404 for a session belonging to another user", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({ userId: OTHER_USER.id, type: "technical", config: {} })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(404);
  });

  // 3. Behavioral session → 400
  it("returns 400 for a behavioral session", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({ userId: TEST_USER.id, type: "behavioral", config: {} })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/technical/i);
  });

  // 4. Free user, 0 hints used → 201, hintsUsed=1, hintsRemaining=0; DB persisted
  it("returns 201 for free user first hint, persists DB update", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        config: {},
        hintsUsed: 0,
        hintsGiven: [],
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "Think about using a hash map." } }],
    });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(201);

    const responseBody = await res.json();
    expect(responseBody.hint).toBe("Think about using a hash map.");
    expect(responseBody.hintsUsed).toBe(1);
    expect(responseBody.hintsRemaining).toBe(0);

    // Verify DB persisted
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, session.id));
    expect(row.hintsUsed).toBe(1);
    const hintsGiven = row.hintsGiven as Array<{ text: string }>;
    expect(hintsGiven).toHaveLength(1);
    expect(hintsGiven[0].text).toBe("Think about using a hash map.");
  });

  // 5. Free user, 1 hint already used → 429
  it("returns 429 when free user has exhausted hint quota (1/1)", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        config: {},
        hintsUsed: 1,
        hintsGiven: [{ text: "Already given hint." }],
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.hintsUsed).toBe(1);
    expect(body.hintsRemaining).toBe(0);

    // OpenAI should NOT have been called
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  // 6. Pro user, 2 hints used → 201; hintsUsed=3, hintsRemaining=0; DB correct
  it("returns 201 for pro user third hint (2/3 used), persists DB update", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "technical",
        config: {},
        hintsUsed: 2,
        hintsGiven: [{ text: "Hint 1." }, { text: "Hint 2." }],
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "Focus on the specific step where the pointer stops." } }],
    });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(201);

    const responseBody = await res.json();
    expect(responseBody.hintsUsed).toBe(3);
    expect(responseBody.hintsRemaining).toBe(0);

    // Verify DB persisted
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, session.id));
    expect(row.hintsUsed).toBe(3);
    const hintsGiven = row.hintsGiven as Array<{ text: string }>;
    expect(hintsGiven).toHaveLength(3);
    expect(hintsGiven[2].text).toBe("Focus on the specific step where the pointer stops.");
  });

  // 7. Pro user, 3 hints used → 429
  it("returns 429 when pro user has exhausted hint quota (3/3)", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "technical",
        config: {},
        hintsUsed: 3,
        hintsGiven: [{ text: "H1" }, { text: "H2" }, { text: "H3" }],
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.hintsUsed).toBe(3);
    expect(body.hintsRemaining).toBe(0);

    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  // 8. Hint #2 payload includes hint #1 text in the prompt
  it("includes prior hints in the OpenAI prompt when requesting hint #2", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "technical",
        config: {},
        hintsUsed: 1,
        hintsGiven: [{ text: "Think about hash maps." }],
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "Consider the key you would use." } }],
    });

    const res = await POST(makePostRequest(session.id), makeParams(session.id));
    expect(res.status).toBe(201);

    // Assert that the OpenAI call included the prior hint in the user message
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    const userContent = call.messages.find(
      (m: { role: string }) => m.role === "user"
    )?.content as string;
    expect(userContent).toContain("Think about hash maps.");
  });

  // 9. Invalid body (missing required field) → 400
  it("returns 400 for invalid body (missing code field)", async () => {
    const db = getTestDb();
    const [session] = await db
      .insert(interviewSessions)
      .values({ userId: TEST_USER.id, type: "technical", config: {} })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const invalidBody = {
      problemTitle: "Two Sum",
      // missing problemDescription, code, language
    };

    const res = await POST(makePostRequest(session.id, invalidBody), makeParams(session.id));
    expect(res.status).toBe(400);
  });
});
