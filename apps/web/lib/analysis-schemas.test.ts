import { describe, it, expect } from "vitest";
import {
  answerAnalysisSchema,
  driftAnalysisSchema,
  feedbackRequestSchema,
  feedbackResponseSchema,
  technicalFeedbackRequestSchema,
  technicalFeedbackResponseSchema,
} from "./analysis-schemas";

const VALID_ANSWER = {
  question: "Tell me about a time...",
  answer_summary: "Did things",
  score: 7,
  feedback: "Good",
  suggestions: ["More detail"],
};

const VALID_FEEDBACK_RESPONSE = {
  overall_score: 7.5,
  summary: "Solid",
  strengths: ["a", "b"],
  weaknesses: ["c"],
  answer_analyses: [VALID_ANSWER],
};

describe("answerAnalysisSchema", () => {
  it("accepts a valid answer analysis", () => {
    expect(answerAnalysisSchema.safeParse(VALID_ANSWER).success).toBe(true);
  });

  it("rejects score below 0", () => {
    expect(
      answerAnalysisSchema.safeParse({ ...VALID_ANSWER, score: -0.1 }).success,
    ).toBe(false);
  });

  it("accepts score exactly 0", () => {
    expect(
      answerAnalysisSchema.safeParse({ ...VALID_ANSWER, score: 0 }).success,
    ).toBe(true);
  });

  it("accepts score exactly 10", () => {
    expect(
      answerAnalysisSchema.safeParse({ ...VALID_ANSWER, score: 10 }).success,
    ).toBe(true);
  });

  it("rejects score above 10", () => {
    expect(
      answerAnalysisSchema.safeParse({ ...VALID_ANSWER, score: 10.1 }).success,
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(answerAnalysisSchema.safeParse({ score: 5 }).success).toBe(false);
  });
});

describe("feedbackResponseSchema", () => {
  it("accepts canonical fixture", () => {
    const result = feedbackResponseSchema.safeParse(VALID_FEEDBACK_RESPONSE);
    expect(result.success).toBe(true);
  });

  it("rejects overall_score above 10", () => {
    expect(
      feedbackResponseSchema.safeParse({
        ...VALID_FEEDBACK_RESPONSE,
        overall_score: 11,
      }).success,
    ).toBe(false);
  });

  it("rejects missing summary", () => {
    const { summary: _omit, ...without } = VALID_FEEDBACK_RESPONSE;
    void _omit;
    expect(feedbackResponseSchema.safeParse(without).success).toBe(false);
  });

  it("accepts drift_analysis when present with all four arrays", () => {
    const result = feedbackResponseSchema.safeParse({
      ...VALID_FEEDBACK_RESPONSE,
      drift_analysis: {
        added: ["mentioned budget"],
        omitted: ["dropped timeline"],
        tightened: ["concise background"],
        loosened: [],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drift_analysis?.added).toHaveLength(1);
    }
  });

  it("accepts drift_analysis as null", () => {
    const result = feedbackResponseSchema.safeParse({
      ...VALID_FEEDBACK_RESPONSE,
      drift_analysis: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drift_analysis).toBeNull();
    }
  });

  it("accepts response without drift_analysis field (optional)", () => {
    const result = feedbackResponseSchema.safeParse(VALID_FEEDBACK_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drift_analysis).toBeUndefined();
    }
  });
});

describe("driftAnalysisSchema", () => {
  it("accepts valid drift with all four arrays", () => {
    const result = driftAnalysisSchema.safeParse({
      added: ["a"],
      omitted: ["b"],
      tightened: ["c"],
      loosened: ["d"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty arrays for all sections", () => {
    const result = driftAnalysisSchema.safeParse({
      added: [],
      omitted: [],
      tightened: [],
      loosened: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null (no drift data)", () => {
    const result = driftAnalysisSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("rejects object missing required keys", () => {
    const result = driftAnalysisSchema.safeParse({ added: [], omitted: [] });
    expect(result.success).toBe(false);
  });
});

describe("feedbackRequestSchema", () => {
  it("accepts a minimal valid request and defaults config", () => {
    const result = feedbackRequestSchema.safeParse({
      session_id: "abc",
      transcript: [{ speaker: "ai", text: "Hi", timestamp_ms: 0 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config.difficulty).toBe(0.5);
      expect(result.data.config.interview_style).toBe(0.5);
    }
  });

  it("rejects request missing session_id", () => {
    expect(
      feedbackRequestSchema.safeParse({
        transcript: [{ speaker: "ai", text: "Hi", timestamp_ms: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("technicalFeedbackRequestSchema", () => {
  it("accepts a valid technical request with loose config dict", () => {
    const result = technicalFeedbackRequestSchema.safeParse({
      session_id: "abc",
      transcript: [{ speaker: "user", text: "hi", timestamp_ms: 0 }],
      code_snapshots: [
        { code: "x", language: "py", timestamp_ms: 1, event_type: "edit" },
      ],
      config: { interview_type: "leetcode", anything_extra: 42 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects technical request missing config", () => {
    expect(
      technicalFeedbackRequestSchema.safeParse({
        session_id: "abc",
        transcript: [],
        code_snapshots: [],
      }).success,
    ).toBe(false);
  });
});

describe("technicalFeedbackResponseSchema", () => {
  const VALID_TECH = {
    overall_score: 7,
    summary: "Solid",
    strengths: ["a"],
    weaknesses: ["b"],
    code_quality_score: 6.5,
    explanation_quality_score: 7.5,
    answer_analyses: [VALID_ANSWER],
    timeline_analysis: [
      {
        timestamp_ms: 0,
        event_type: "speech" as const,
        summary: "hi",
        code: null,
        full_text: null,
      },
    ],
  };

  it("accepts canonical valid response", () => {
    expect(technicalFeedbackResponseSchema.safeParse(VALID_TECH).success).toBe(true);
  });

  it("rejects code_quality_score above 10", () => {
    expect(
      technicalFeedbackResponseSchema.safeParse({
        ...VALID_TECH,
        code_quality_score: 11,
      }).success,
    ).toBe(false);
  });

  it("rejects explanation_quality_score below 0", () => {
    expect(
      technicalFeedbackResponseSchema.safeParse({
        ...VALID_TECH,
        explanation_quality_score: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects missing timeline_analysis", () => {
    const { timeline_analysis: _omit, ...without } = VALID_TECH;
    void _omit;
    expect(technicalFeedbackResponseSchema.safeParse(without).success).toBe(false);
  });
});
