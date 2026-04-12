import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, companyQuestions } from "@/lib/schema";
import { NextRequest } from "next/server";

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
  default: class {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// Set OPENAI_API_KEY for the route
vi.stubEnv("OPENAI_API_KEY", "test-key");

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "questions-test@example.com",
  name: "Questions Test User",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/questions/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const MOCK_QUESTIONS = [
  {
    question: "Tell me about a time you demonstrated customer obsession.",
    category: "customer-focus",
    tip: "Use a specific example with measurable impact.",
  },
  {
    question: "Describe a situation where you had to take ownership beyond your role.",
    category: "leadership",
    tip: "Show initiative and accountability for the outcome.",
  },
];

describe("POST /api/questions/generate (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(companyQuestions);

    // Default mock: successful GPT response
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ questions: MOCK_QUESTIONS }),
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
    const res = await POST(makeRequest({ company: "Google" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when company is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when company is empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ company: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when count is out of range", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ company: "Google", count: 50 }));
    expect(res.status).toBe(400);
  });

  it("generates questions successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ company: "Amazon" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.company).toBe("Amazon");
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0]).toHaveProperty("question");
    expect(data.questions[0]).toHaveProperty("category");
    expect(data.questions[0]).toHaveProperty("tip");
    expect(data.cached).toBe(false);
  });

  it("generates questions with role", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ company: "Google", role: "Senior Engineer" })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.role).toBe("Senior Engineer");
    expect(data.cached).toBe(false);
  });

  it("persists generated questions to database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    await POST(makeRequest({ company: "Meta" }));

    const db = getTestDb();
    const rows = await db.select().from(companyQuestions);
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("meta");
    expect(rows[0].userId).toBe(TEST_USER.id);
    expect(rows[0].role).toBeNull();
  });

  it("returns cached results for same company within 7 days", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // First call — generates
    const res1 = await POST(makeRequest({ company: "Amazon" }));
    expect((await res1.json()).cached).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Second call — should return cached
    const res2 = await POST(makeRequest({ company: "Amazon" }));
    const data2 = await res2.json();
    expect(data2.cached).toBe(true);
    expect(data2.questions).toHaveLength(2);
    // GPT should NOT have been called again
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("does not cache across different roles", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    await POST(makeRequest({ company: "Google", role: "PM" }));
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await POST(makeRequest({ company: "Google", role: "SWE" }));
    // Different role, should generate again
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("normalizes company name for caching", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    await POST(makeRequest({ company: "Google" }));
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Same company, different case — should hit cache
    await POST(makeRequest({ company: "GOOGLE" }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
