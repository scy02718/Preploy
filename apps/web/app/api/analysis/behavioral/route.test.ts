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

// Route now auths + rate-limits; tests default to "signed-in, not limited".
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
}));
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { POST } from "./route";

const VALID_GPT_RESPONSE = readFileSync(
  join(__dirname, "..", "__fixtures__", "behavioral-gpt-response.json"),
  "utf-8",
);

const SAMPLE_TRANSCRIPT = [
  { speaker: "ai", text: "Tell me about yourself.", timestamp_ms: 0 },
  { speaker: "user", text: "I'm an engineer.", timestamp_ms: 5000 },
];

const VALID_BODY = {
  session_id: "sess-1",
  transcript: SAMPLE_TRANSCRIPT,
  config: { difficulty: 0.8 },
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/analysis/behavioral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analysis/behavioral (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns 400 when JSON body cannot be parsed", async () => {
    const req = new NextRequest("http://localhost:3000/api/analysis/behavioral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when session_id is missing", async () => {
    const res = await POST(makeRequest({ transcript: SAMPLE_TRANSCRIPT }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on empty transcript", async () => {
    const res = await POST(
      makeRequest({ session_id: "s", transcript: [], config: {} }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("returns 200 with validated response on happy path", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overall_score).toBe(7.5);
    expect(body.answer_analyses).toHaveLength(2);
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
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

  it("retries once on empty content then returns the parsed result", async () => {
    mockChatCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
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

  it("returns 500 after two schema-invalid responses", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: '{"overall_score": 5}' } }],
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
