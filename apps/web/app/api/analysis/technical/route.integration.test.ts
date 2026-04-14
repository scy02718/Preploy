/**
 * Integration test for POST /api/analysis/technical.
 *
 * Like the behavioral integration test, this route has no DB and no auth.
 * The integration suite still exercises the full Zod-validated request →
 * response pipeline with a mocked OpenAI client and re-parses the response
 * with `technicalFeedbackResponseSchema` to prove every constraint passes.
 *
 * The "timeline_injected_from_correlator_not_gpt" test asserts that even if
 * GPT returns an empty timeline_analysis, the route MUST overwrite it with
 * the deterministic `buildTimeline()` result before validation.
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

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { POST } from "./route";
import { technicalFeedbackResponseSchema } from "@/lib/analysis-schemas";

const VALID_GPT_RESPONSE_RAW = readFileSync(
  join(__dirname, "..", "__fixtures__", "technical-gpt-response.json"),
  "utf-8",
);
const VALID_GPT_RESPONSE_OBJ = JSON.parse(VALID_GPT_RESPONSE_RAW);

const SAMPLE_TRANSCRIPT = [
  { speaker: "user", text: "I'll use a sliding window approach.", timestamp_ms: 1000 },
  { speaker: "user", text: "The time complexity is O(n).", timestamp_ms: 5000 },
];

const SAMPLE_SNAPSHOTS = [
  { code: "def solution(): pass", language: "python", timestamp_ms: 500, event_type: "edit" },
  {
    code: "def solution(nums):\n    return max(nums)",
    language: "python",
    timestamp_ms: 8000,
    event_type: "edit",
  },
];

const VALID_BODY = {
  session_id: "sess-tech-int-1",
  transcript: SAMPLE_TRANSCRIPT,
  code_snapshots: SAMPLE_SNAPSHOTS,
  config: {
    interview_type: "leetcode",
    focus_areas: ["arrays", "sliding_window"],
    difficulty: "medium",
    language: "python",
  },
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/analysis/technical", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analysis/technical (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on empty transcript", async () => {
    const res = await POST(
      makeRequest({
        session_id: "s",
        transcript: [],
        code_snapshots: [],
        config: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on missing required field (code_snapshots)", async () => {
    const res = await POST(
      makeRequest({
        session_id: "s",
        transcript: SAMPLE_TRANSCRIPT,
        config: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it("returns 200 with full Zod-validated body matching the canonical fixture", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const body = await res.json();
    const reparsed = technicalFeedbackResponseSchema.safeParse(body);
    expect(reparsed.success).toBe(true);

    expect(body.overall_score).toBe(7.0);
    expect(body.code_quality_score).toBe(6.5);
    expect(body.explanation_quality_score).toBe(7.5);
    expect(body.strengths).toHaveLength(3);
    expect(body.weaknesses).toHaveLength(3);
    expect(body.answer_analyses).toHaveLength(1);
    expect(body.answer_analyses[0].score).toBe(7.0);
    // Timeline should always be populated (from buildTimeline, not GPT).
    expect(body.timeline_analysis.length).toBe(
      SAMPLE_TRANSCRIPT.length + SAMPLE_SNAPSHOTS.length,
    );
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
        choices: [{ message: { content: VALID_GPT_RESPONSE_RAW } }],
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(technicalFeedbackResponseSchema.safeParse(body).success).toBe(true);
  });

  it("timeline_injected_from_correlator_not_gpt: overrides GPT's empty timeline", async () => {
    // GPT returns the fixture but with timeline_analysis explicitly empty.
    const gptResponse = {
      ...VALID_GPT_RESPONSE_OBJ,
      timeline_analysis: [],
    };
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(gptResponse) } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const body = await res.json();
    // The route MUST overwrite GPT's empty list with the buildTimeline result.
    expect(body.timeline_analysis.length).toBeGreaterThan(0);
    expect(body.timeline_analysis.length).toBe(
      SAMPLE_TRANSCRIPT.length + SAMPLE_SNAPSHOTS.length,
    );
    // Timeline should be sorted by timestamp_ms.
    const timestamps = body.timeline_analysis.map(
      (e: { timestamp_ms: number }) => e.timestamp_ms,
    );
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
    // Earliest event should be the first snapshot at 500ms.
    expect(timestamps[0]).toBe(500);
  });
});
