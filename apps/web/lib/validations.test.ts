import { describe, it, expect } from "vitest";
import {
  behavioralConfigSchema,
  technicalConfigSchema,
  createSessionSchema,
  transcriptEntryInputSchema,
  codeSnapshotInputSchema,
  timelineEventSchema,
} from "./validations";

describe("behavioralConfigSchema", () => {
  it("accepts a valid config with all fields", () => {
    const result = behavioralConfigSchema.safeParse({
      company_name: "Google",
      job_description: "Senior Frontend Engineer",
      expected_questions: ["Tell me about yourself"],
      interview_style: 0.5,
      difficulty: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal config (only required fields)", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing interview_style", () => {
    const result = behavioralConfigSchema.safeParse({
      difficulty: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing difficulty", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects job_description over 5000 chars", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
      job_description: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects expected_questions with more than 10 items", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
      expected_questions: Array.from({ length: 11 }, (_, i) => `Question ${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects interview_style below 0", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: -0.1,
      difficulty: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects interview_style above 1", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 1.1,
      difficulty: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects difficulty outside 0-1 range", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 2.0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values (0 and 1)", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0,
      difficulty: 1,
    });
    expect(result.success).toBe(true);
  });

  // ---- #183: focus_directive ----

  it("#183: accepts valid focus_directive up to 500 chars", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
      focus_directive: "leadership and conflict resolution",
    });
    expect(result.success).toBe(true);
  });

  it("#183: accepts missing focus_directive (optional)", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("#183: rejects focus_directive over 500 chars", () => {
    const result = behavioralConfigSchema.safeParse({
      interview_style: 0.5,
      difficulty: 0.5,
      focus_directive: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("technicalConfigSchema", () => {
  it("accepts a valid technical config", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays", "trees"],
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid interview types", () => {
    for (const type of ["leetcode", "system_design", "frontend", "backend"]) {
      const result = technicalConfigSchema.safeParse({
        interview_type: type,
        focus_areas: ["arrays"],
        language: "javascript",
        difficulty: "easy",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty focus_areas array", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: [],
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing focus_areas", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid interview_type", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "invalid_type",
      focus_areas: ["arrays"],
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays"],
      language: "python",
      difficulty: "impossible",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty language string", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays"],
      language: "",
      difficulty: "hard",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid difficulty levels", () => {
    for (const diff of ["easy", "medium", "hard"]) {
      const result = technicalConfigSchema.safeParse({
        interview_type: "leetcode",
        focus_areas: ["dynamic_programming"],
        language: "java",
        difficulty: diff,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional additional_instructions", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays"],
      language: "python",
      difficulty: "medium",
      additional_instructions: "Focus on Google-style problems",
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing additional_instructions", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays"],
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(true);
  });

  it("rejects additional_instructions over 1000 chars", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays"],
      language: "python",
      difficulty: "medium",
      additional_instructions: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  // 123-I: Zod validator accepts "other" sentinel in focus_areas
  it("accepts 'other' sentinel in focus_areas", () => {
    const result = technicalConfigSchema.safeParse({
      interview_type: "leetcode",
      focus_areas: ["arrays", "other"],
      language: "python",
      difficulty: "medium",
    });
    expect(result.success).toBe(true);
  });
});

describe("createSessionSchema", () => {
  it("accepts valid behavioral session", () => {
    const result = createSessionSchema.safeParse({
      type: "behavioral",
      config: { interview_style: 0.5 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid technical session", () => {
    const result = createSessionSchema.safeParse({
      type: "technical",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid session type", () => {
    const result = createSessionSchema.safeParse({
      type: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("transcriptEntryInputSchema", () => {
  it("accepts a valid transcript entry", () => {
    const result = transcriptEntryInputSchema.safeParse({
      speaker: "user",
      text: "I would use a hash map here.",
      timestamp_ms: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing timestamp_ms", () => {
    const result = transcriptEntryInputSchema.safeParse({
      speaker: "user",
      text: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer timestamp_ms", () => {
    const result = transcriptEntryInputSchema.safeParse({
      speaker: "user",
      text: "hello",
      timestamp_ms: 12.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("codeSnapshotInputSchema", () => {
  it("accepts a valid code snapshot", () => {
    const result = codeSnapshotInputSchema.safeParse({
      code: "def foo(): pass",
      language: "python",
      timestamp_ms: 500,
      event_type: "edit",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing timestamp_ms", () => {
    const result = codeSnapshotInputSchema.safeParse({
      code: "def foo(): pass",
      language: "python",
      event_type: "edit",
    });
    expect(result.success).toBe(false);
  });
});

describe("timelineEventSchema", () => {
  it("accepts a valid speech event", () => {
    const result = timelineEventSchema.safeParse({
      timestamp_ms: 1000,
      event_type: "speech",
      summary: "Hello",
      code: null,
      full_text: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event_type literal", () => {
    const result = timelineEventSchema.safeParse({
      timestamp_ms: 1000,
      event_type: "unknown",
      summary: "Hello",
    });
    expect(result.success).toBe(false);
  });
});
