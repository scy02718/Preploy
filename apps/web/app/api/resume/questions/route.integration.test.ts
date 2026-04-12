import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, userResumes } from "@/lib/schema";

// Use vi.hoisted so the mock fn is available when vi.mock factories run
const { mockAuth, mockCreate } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test-questions@example.com",
  name: "Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other-questions@example.com",
  name: "Other User",
};

let testResumeId: string;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/resume/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_QUESTIONS = [
  {
    question: "Tell me about the migration project at Acme Corp.",
    resume_reference: "Led migration of monolith to microservices",
    category: "leadership",
  },
  {
    question: "How did you achieve the 40% latency reduction?",
    resume_reference: "Reducing latency by 40%",
    category: "problem-solving",
  },
];

describe("API POST /api/resume/questions (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();

    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "test.txt",
        content: "John Doe\nSoftware Engineer at Acme Corp\nLed migration of monolith to microservices, reducing latency by 40%",
      })
      .returning();
    testResumeId = resume.id;
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_QUESTIONS),
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
      makeRequest({ resume_id: testResumeId, question_type: "behavioral" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing resume_id", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ question_type: "behavioral" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request");
  });

  it("returns 400 for invalid question_type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ resume_id: testResumeId, question_type: "invalid" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid resume_id format", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ resume_id: "not-a-uuid", question_type: "behavioral" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when resume does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({
        resume_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        question_type: "behavioral",
      })
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("returns 404 when accessing another user's resume (authorization)", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await POST(
      makeRequest({ resume_id: testResumeId, question_type: "behavioral" })
    );
    expect(res.status).toBe(404);
  });

  it("generates behavioral questions successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ resume_id: testResumeId, question_type: "behavioral" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0].question).toContain("migration");
    expect(data.questions[0].category).toBe("leadership");
  });

  it("generates technical questions successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ resume_id: testResumeId, question_type: "technical" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toHaveLength(2);
  });

  it("passes company and role to the prompt", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({
        resume_id: testResumeId,
        question_type: "behavioral",
        company: "Google",
        role: "Senior SWE",
      })
    );
    expect(res.status).toBe(200);

    // Verify OpenAI was called with prompt containing company/role
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    expect(promptContent).toContain("Google");
    expect(promptContent).toContain("Senior SWE");
  });

  it("handles GPT error gracefully", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCreate.mockRejectedValue(new Error("API error"));
    const res = await POST(
      makeRequest({ resume_id: testResumeId, question_type: "behavioral" })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to generate");
  });
});
