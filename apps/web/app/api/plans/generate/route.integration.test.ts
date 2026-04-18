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
} from "../../../../tests/setup-db";
import { users, interviewPlans, interviewSessions, sessionFeedback } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// Mock OPENAI_API_KEY
vi.stubEnv("OPENAI_API_KEY", "test-key");

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

const MOCK_PLAN_RESPONSE = {
  days: [
    {
      date: "2026-04-12",
      focus: "behavioral",
      day_type: "behavioral",
      topics: ["STAR method", "Leadership questions"],
      session_type: "behavioral",
      completed: false,
    },
    {
      date: "2026-04-13",
      focus: "technical",
      day_type: "technical",
      topics: ["Arrays", "Hash maps"],
      session_type: "technical",
      completed: false,
    },
  ],
};

const MOCK_PLAN_WITH_STAR_PREP = {
  days: [
    {
      date: "2026-04-12",
      focus: "behavioral",
      day_type: "star-prep",
      topics: ["STAR storytelling", "Conflict narrative"],
      session_type: "behavioral",
      completed: false,
    },
    {
      date: "2026-04-13",
      focus: "technical",
      day_type: "technical",
      topics: ["Arrays", "Sorting"],
      session_type: "technical",
      completed: false,
    },
    {
      date: "2026-04-14",
      focus: "behavioral",
      day_type: "resume",
      topics: ["Resume tailoring"],
      session_type: "behavioral",
      completed: false,
    },
  ],
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/plans/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plans/generate (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(interviewPlans);
    await db.delete(sessionFeedback);
    await db.delete(interviewSessions);

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_PLAN_RESPONSE),
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        company: "Google",
        role: "SWE",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing company", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ role: "SWE", interview_date: "2026-05-01" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing role", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ company: "Google", interview_date: "2026-05-01" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing interview_date", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ company: "Google", role: "SWE" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty company string", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ company: "", role: "SWE", interview_date: "2026-05-01" })
    );
    expect(res.status).toBe(400);
  });

  it("generates a plan and returns 201 with persisted data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({
        company: "Google",
        role: "Senior SWE",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.company).toBe("Google");
    expect(data.role).toBe("Senior SWE");
    expect(data.planData.days).toHaveLength(2);
    expect(data.planData.days[0].completed).toBe(false);

    // Verify persisted in database
    const db = getTestDb();
    const rows = await db.select().from(interviewPlans);
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Google");
  });

  it("preserves day_type field including star-prep when persisting generated plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Override mock to return plan with star-prep days
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_PLAN_WITH_STAR_PREP),
          },
        },
      ],
    });

    const res = await POST(
      makeRequest({
        company: "Stripe",
        role: "Full Stack Engineer",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.planData.days[0].day_type).toBe("star-prep");
    expect(data.planData.days[1].day_type).toBe("technical");
    expect(data.planData.days[2].day_type).toBe("resume");

    // Verify persisted day_type in DB
    const db = getTestDb();
    const rows = await db.select().from(interviewPlans);
    const planData = rows[0].planData as { days: Array<{ day_type?: string }> };
    expect(planData.days[0].day_type).toBe("star-prep");
  });

  it("includes weak areas from past feedback in the prompt", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    // Create sessions with feedback containing recurring weaknesses
    const [s1] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        status: "completed",
        config: {},
      })
      .returning();
    const [s2] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        status: "completed",
        config: {},
      })
      .returning();

    await db.insert(sessionFeedback).values([
      { sessionId: s1.id, overallScore: 6.0, weaknesses: ["time management", "quantifying impact"] },
      { sessionId: s2.id, overallScore: 5.0, weaknesses: ["time management", "complexity analysis"] },
    ]);

    const res = await POST(
      makeRequest({
        company: "Meta",
        role: "Frontend Engineer",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(201);

    // Verify OpenAI was called (the prompt building happened)
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when OpenAI returns empty response", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const res = await POST(
      makeRequest({
        company: "Google",
        role: "SWE",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(500);
  });

  it("returns 500 when OpenAI call fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCreate.mockRejectedValue(new Error("API error"));

    const res = await POST(
      makeRequest({
        company: "Google",
        role: "SWE",
        interview_date: "2026-05-01",
      })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to generate plan");
  });
});
