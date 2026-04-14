/**
 * Unit tests for `runTechnicalAnalysis`. Mocks the `openai` module and
 * exercises happy-path, the timeline-overwrite invariant, and retry-exhaustion.
 * Mirrors the mock pattern used in
 * `app/api/analysis/technical/route.integration.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

import { runTechnicalAnalysis } from "./analysis-technical";
import {
  technicalFeedbackRequestSchema,
  technicalFeedbackResponseSchema,
} from "@/lib/analysis-schemas";
import { buildTimeline } from "@/lib/timeline-correlator";
import { OpenAIRetryError } from "@/lib/openai-retry";

const VALID_GPT_RESPONSE_RAW = readFileSync(
  join(
    __dirname,
    "..",
    "app",
    "api",
    "analysis",
    "__fixtures__",
    "technical-gpt-response.json",
  ),
  "utf-8",
);
const VALID_GPT_RESPONSE_OBJ = JSON.parse(VALID_GPT_RESPONSE_RAW);

const silentLogger = pino({ level: "silent" });

const SAMPLE_TRANSCRIPT = [
  {
    speaker: "user",
    text: "I'll use a sliding window approach.",
    timestamp_ms: 1000,
  },
  { speaker: "user", text: "The time complexity is O(n).", timestamp_ms: 5000 },
];

const SAMPLE_SNAPSHOTS = [
  {
    code: "def solution(): pass",
    language: "python",
    timestamp_ms: 500,
    event_type: "edit",
  },
  {
    code: "def solution(nums):\n    return max(nums)",
    language: "python",
    timestamp_ms: 8000,
    event_type: "edit",
  },
];

const VALID_INPUT = technicalFeedbackRequestSchema.parse({
  session_id: "sess-tech-unit-1",
  transcript: SAMPLE_TRANSCRIPT,
  code_snapshots: SAMPLE_SNAPSHOTS,
  config: {
    interview_type: "leetcode",
    focus_areas: ["arrays", "sliding_window"],
    difficulty: "medium",
    language: "python",
  },
});

describe("runTechnicalAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: returns a valid TechnicalFeedbackResponse from a fixture GPT reply", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_GPT_RESPONSE_RAW } }],
    });

    const result = await runTechnicalAnalysis(VALID_INPUT, {
      log: silentLogger,
    });

    const reparsed = technicalFeedbackResponseSchema.safeParse(result);
    expect(reparsed.success).toBe(true);
    expect(result.overall_score).toBe(7.0);
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
  });

  it("timeline overwrite invariant: replaces GPT's empty timeline with buildTimeline()", async () => {
    const gptResponse = {
      ...VALID_GPT_RESPONSE_OBJ,
      timeline_analysis: [],
    };
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(gptResponse) } }],
    });

    const result = await runTechnicalAnalysis(VALID_INPUT, {
      log: silentLogger,
    });

    const expectedTimeline = buildTimeline(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS);
    // The runner MUST overwrite GPT's empty list with the buildTimeline result.
    expect(result.timeline_analysis.length).toBe(
      SAMPLE_TRANSCRIPT.length + SAMPLE_SNAPSHOTS.length,
    );
    expect(result.timeline_analysis).toEqual(expectedTimeline);
    // Sorted by timestamp_ms; earliest event is the first snapshot at 500ms.
    const timestamps = result.timeline_analysis.map((e) => e.timestamp_ms);
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
    expect(timestamps[0]).toBe(500);
  });

  it("retry exhaustion: throws OpenAIRetryError after two malformed responses", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });

    await expect(
      runTechnicalAnalysis(VALID_INPUT, { log: silentLogger }),
    ).rejects.toThrow(OpenAIRetryError);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });
});
