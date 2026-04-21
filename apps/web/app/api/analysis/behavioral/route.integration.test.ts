/**
 * Integration test for POST /api/analysis/behavioral.
 *
 * This route has no DB calls and no auth — it's a pure server-to-server
 * GPT proxy. The integration suite still exercises the full Zod-validated
 * request → response pipeline against a mocked OpenAI client and re-parses
 * the response body with `feedbackResponseSchema` to prove every constraint
 * in the wire contract is satisfied.
 *
 * Story 22 acceptance criteria: "Integration tests mock OpenAI and assert
 * full Zod-validated response shapes."
 *
 * Story 177: tier tests verify Pro users get the stronger model + Pro prompt.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTestDb } from "../../../../tests/setup-db";
import { users } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

const { mockChatCreate, mockAuthFn } = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockAuthFn: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

// The route now auths + rate-limits like any other OpenAI-burning endpoint.
// Tests stub both to return "signed-in, not rate-limited" by default; any
// test that wants to exercise the 401 / 429 paths can override in-file.
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuthFn(),
}));
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// getCurrentUserPlan queries @/lib/db — redirect to test DB so the function
// can run for real (unknown users fall back to "free"; pro tests seed a pro user).
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { POST } from "./route";
import { feedbackResponseSchema } from "@/lib/analysis-schemas";
import {
  BEHAVIORAL_SYSTEM_PROMPT,
  BEHAVIORAL_SYSTEM_PROMPT_PRO,
} from "@/lib/analysis-prompts";


const VALID_GPT_RESPONSE = readFileSync(
  join(__dirname, "..", "__fixtures__", "behavioral-gpt-response.json"),
  "utf-8",
);

const SAMPLE_TRANSCRIPT = [
  { speaker: "ai", text: "Tell me about a time you led a team.", timestamp_ms: 0 },
  {
    speaker: "user",
    text: "I led a team of 5 engineers to ship a feature in 3 weeks.",
    timestamp_ms: 5000,
  },
  { speaker: "ai", text: "What challenges did you face?", timestamp_ms: 15000 },
  {
    speaker: "user",
    text: "Tight deadlines; we cut scope.",
    timestamp_ms: 20000,
  },
];

const VALID_BODY = {
  session_id: "sess-integration-1",
  transcript: SAMPLE_TRANSCRIPT,
  config: {
    company_name: "Google",
    job_description: "Senior Software Engineer",
    difficulty: 0.8,
    interview_style: 0.5,
  },
};

// Auth mock returns this user ID by default
const FREE_USER_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const PRO_USER_ID = "bbbbbbbb-0000-0000-0000-000000000002";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/analysis/behavioral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analysis/behavioral (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db
      .insert(users)
      .values({ id: FREE_USER_ID, email: "free-behavioral@example.com", name: "Free User" })
      .onConflictDoNothing();
    await db
      .insert(users)
      .values({ id: PRO_USER_ID, email: "pro-behavioral@example.com", name: "Pro User", plan: "pro" })
      .onConflictDoNothing();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as free user
    mockAuthFn.mockResolvedValue({ user: { id: FREE_USER_ID } });
    // Ensure OPENAI_API_KEY is always set — vi.unstubAllEnvs() in afterEach
    // would clear the module-level vi.stubEnv call otherwise.
    vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");
  });

  afterEach(() => {
    // Only unstub test-specific env overrides; re-stub of OPENAI_API_KEY happens in beforeEach.
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    // Only clean up the users we seeded — don't tear down the shared test DB
    // connection or delete other test suites' data.
    const db = getTestDb();
    await db.delete(users).where(or(eq(users.id, FREE_USER_ID), eq(users.id, PRO_USER_ID)));
  });

  it("returns 400 on empty transcript", async () => {
    const res = await POST(
      makeRequest({ session_id: "s", transcript: [], config: {} }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on missing required field (session_id)", async () => {
    const res = await POST(
      makeRequest({ transcript: SAMPLE_TRANSCRIPT, config: {} }),
    );
    expect(res.status).toBe(400);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it("returns 200 with full Zod-validated body matching the canonical fixture", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const body = await res.json();

    // Re-parse with the schema to prove every Zod constraint passes end-to-end.
    const reparsed = feedbackResponseSchema.safeParse(body);
    expect(reparsed.success).toBe(true);

    expect(body.overall_score).toBe(7.5);
    expect(body.summary).toContain("leadership");
    expect(body.strengths).toHaveLength(3);
    expect(body.weaknesses).toHaveLength(3);
    expect(body.answer_analyses).toHaveLength(2);
    expect(body.answer_analyses[0].score).toBe(8.0);
    expect(body.answer_analyses[1].score).toBe(7.0);
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 500 after retry exhaustion (two malformed responses)", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "not valid json {{{" } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 200 on retry-then-succeed (empty first, fixture second)", async () => {
    mockChatCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: VALID_GPT_RESPONSE } }],
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);

    const body = await res.json();
    expect(feedbackResponseSchema.safeParse(body).success).toBe(true);
    expect(body.overall_score).toBe(7.5);
  });

  it("pro user: uses PRO_ANALYSIS_MODEL + Pro system prompt", async () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");
    // Authenticate as pro user (seeded in beforeAll with plan="pro")
    mockAuthFn.mockResolvedValue({ user: { id: PRO_USER_ID } });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5-test-pro");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT_PRO);
  });

  it("free user: uses gpt-5.4-mini + Free system prompt", async () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");
    // Authenticate as free user (seeded in beforeAll with plan="free" default)
    mockAuthFn.mockResolvedValue({ user: { id: FREE_USER_ID } });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5.4-mini");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT);
  });
});
