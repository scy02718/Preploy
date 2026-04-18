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
import { users, userResumes } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

// Mock OpenAI
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

import { POST } from "./route";

const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com", name: "Test User" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/questions/smart-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/smart-generate (integration)", () => {
  let resumeId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(userResumes);
    const [r] = await db.insert(userResumes).values({
      userId: TEST_USER.id,
      filename: "resume.txt",
      content: "Senior Engineer at Acme Corp. 10 years Python experience.",
    }).returning();
    resumeId = r.id;

    // This route is Pro-gated only when `resume_id` is present. Default
    // the seeded user to Pro so existing smart-mode tests pass; the
    // free-tier block below flips to "free" to exercise the 402 path.
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, TEST_USER.id));

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify([
        { question: "Tell me about Acme Corp", category: "leadership", tip: "Use STAR" },
      ]) } }],
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ company: "Google", question_type: "behavioral" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing company", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ question_type: "behavioral" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid question_type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ company: "Google", question_type: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("generates questions with company only (no resume)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ company: "Google", question_type: "behavioral" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("company-only");
    expect(data.questions.length).toBeGreaterThanOrEqual(1);
  });

  it("generates smart questions with company + resume", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({
      company: "Google",
      resume_id: resumeId,
      question_type: "behavioral",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("smart");
  });

  it("works for technical question type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({
      company: "Stripe",
      resume_id: resumeId,
      question_type: "technical",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("smart");
  });

  it("ignores invalid resume_id gracefully (Pro user)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({
      company: "Google",
      resume_id: "00000000-0000-0000-0000-000000000099",
      question_type: "behavioral",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("company-only");
  });

  // This route is the parallel attack surface for the Resume feature —
  // any authenticated user could previously post a `resume_id` here and
  // get resume-tailored questions without paying. The gate fires only
  // when a resume_id is supplied (company-only stays free).
  describe("free-tier resume-tailored gating", () => {
    beforeEach(async () => {
      const db = getTestDb();
      await db
        .update(users)
        .set({ plan: "free" })
        .where(eq(users.id, TEST_USER.id));
    });

    it("free user with resume_id is blocked with 402 pro_plan_required", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const res = await POST(
        makeRequest({
          company: "Google",
          resume_id: resumeId,
          question_type: "behavioral",
        })
      );
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data).toEqual({
        error: "pro_plan_required",
        feature: "resume",
        currentPlan: "free",
      });
      // GPT must not be invoked — gate fires before OpenAI.
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("free user WITHOUT resume_id stays allowed (company-only mode)", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const res = await POST(
        makeRequest({ company: "Google", question_type: "behavioral" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe("company-only");
    });
  });
});
