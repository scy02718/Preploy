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

import { POST } from "./route";

const VALID_GPT_RESPONSE = readFileSync(
  join(__dirname, "..", "__fixtures__", "technical-gpt-response.json"),
  "utf-8",
);

const SAMPLE_TRANSCRIPT = [
  { speaker: "user", text: "Sliding window approach.", timestamp_ms: 1000 },
  { speaker: "user", text: "Time complexity is O(n).", timestamp_ms: 5000 },
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
  session_id: "sess-tech-1",
  transcript: SAMPLE_TRANSCRIPT,
  code_snapshots: SAMPLE_SNAPSHOTS,
  config: {
    interview_type: "leetcode",
    focus_areas: ["arrays"],
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

describe("POST /api/analysis/technical (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns 400 when JSON body cannot be parsed", async () => {
    const req = new NextRequest("http://localhost:3000/api/analysis/technical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(
      makeRequest({ session_id: "s", transcript: SAMPLE_TRANSCRIPT }),
    );
    expect(res.status).toBe(400);
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
  });

  it("returns 200 happy path", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code_quality_score).toBe(6.5);
    expect(body.explanation_quality_score).toBe(7.5);
  });

  it("retries once on invalid JSON then returns the parsed result", async () => {
    mockChatCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: VALID_GPT_RESPONSE } }],
      });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 500 after two empty responses", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when OPENAI_API_KEY is unset", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
