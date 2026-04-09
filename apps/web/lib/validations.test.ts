import { describe, it, expect } from "vitest";
import { behavioralConfigSchema, createSessionSchema } from "./validations";

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
