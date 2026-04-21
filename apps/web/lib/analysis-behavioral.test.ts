/**
 * Unit tests for `runBehavioralAnalysis`. Mocks the `openai` module and
 * exercises happy-path + retry-exhaustion branches. Mirrors the mock pattern
 * used in `app/api/analysis/behavioral/route.integration.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";

const mockChatCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-test");

import { runBehavioralAnalysis } from "./analysis-behavioral";
import {
  feedbackRequestSchema,
  feedbackResponseSchema,
} from "@/lib/analysis-schemas";
import { OpenAIRetryError } from "@/lib/openai-retry";
import {
  BEHAVIORAL_SYSTEM_PROMPT,
  BEHAVIORAL_SYSTEM_PROMPT_PRO,
} from "@/lib/analysis-prompts";

const VALID_GPT_RESPONSE = readFileSync(
  join(
    __dirname,
    "..",
    "app",
    "api",
    "analysis",
    "__fixtures__",
    "behavioral-gpt-response.json",
  ),
  "utf-8",
);

const silentLogger = pino({ level: "silent" });

const VALID_INPUT = feedbackRequestSchema.parse({
  session_id: "sess-unit-1",
  transcript: [
    {
      speaker: "ai",
      text: "Tell me about a time you led a team.",
      timestamp_ms: 0,
    },
    {
      speaker: "user",
      text: "I led a team of 5 engineers to ship a feature in 3 weeks.",
      timestamp_ms: 5000,
    },
    {
      speaker: "ai",
      text: "What challenges did you face?",
      timestamp_ms: 15000,
    },
    {
      speaker: "user",
      text: "Tight deadlines; we cut scope.",
      timestamp_ms: 20000,
    },
  ],
  config: {
    company_name: "Google",
    job_description: "Senior Software Engineer",
    difficulty: 0.8,
    interview_style: 0.5,
  },
});

describe("runBehavioralAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("happy path: returns a valid FeedbackResponse from a fixture GPT reply", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    const result = await runBehavioralAnalysis(VALID_INPUT, {
      log: silentLogger,
      tier: "free",
    });

    // Re-parse with the schema to prove every Zod constraint passes.
    const reparsed = feedbackResponseSchema.safeParse(result);
    expect(reparsed.success).toBe(true);
    expect(result.overall_score).toBe(7.5);
    expect(result.answer_analyses).toHaveLength(2);
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
  });

  it("retry exhaustion: throws OpenAIRetryError after two malformed responses", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });

    await expect(
      runBehavioralAnalysis(VALID_INPUT, { log: silentLogger, tier: "free" }),
    ).rejects.toThrow(OpenAIRetryError);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("free tier uses gpt-5.4-mini and Free system prompt", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    await runBehavioralAnalysis(VALID_INPUT, { log: silentLogger, tier: "free" });

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5.4-mini");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT);
  });

  it("pro tier uses PRO_ANALYSIS_MODEL env override and Pro system prompt", async () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    await runBehavioralAnalysis(VALID_INPUT, { log: silentLogger, tier: "pro" });

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5-test-pro");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT_PRO);
  });

  it("pro tier without env override defaults to gpt-5", async () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", undefined as unknown as string);
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_GPT_RESPONSE } }],
    });

    await runBehavioralAnalysis(VALID_INPUT, { log: silentLogger, tier: "pro" });

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5");
  });
});
