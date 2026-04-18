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
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockChatCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

// The route now auths + rate-limits like any other OpenAI-burning endpoint.
// Tests stub both to return "signed-in, not rate-limited" by default; any
// test that wants to exercise the 401 / 429 paths can override in-file.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
}));
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { POST } from "./route";
import { feedbackResponseSchema } from "@/lib/analysis-schemas";

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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/analysis/behavioral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analysis/behavioral (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
