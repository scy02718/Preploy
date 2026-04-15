import { describe, it, expect } from "vitest";
import { starAnalysisResponseSchema } from "./star-analysis-schema";

const validResponse = {
  persuasiveness_score: 78,
  persuasiveness_justification: "Compelling story with concrete metrics and clear impact.",
  star_alignment_score: 85,
  star_breakdown: {
    situation: 90,
    task: 80,
    action: 85,
    result: 85,
  },
  role_fit_score: 80,
  role_fit_justification: "Strong alignment with the engineering leadership requirements.",
  question_fit_score: 75,
  question_fit_justification: "Addresses the leadership aspect but could be more direct.",
  suggestions: [
    "Add specific numbers to your Action section",
    "Clarify your personal contribution vs team effort",
    "Quantify the business impact in the Result",
  ],
};

describe("starAnalysisResponseSchema", () => {
  it("validates a well-formed response", () => {
    const result = starAnalysisResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("parses all score fields as numbers", () => {
    const result = starAnalysisResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.persuasiveness_score).toBe("number");
      expect(typeof result.data.star_alignment_score).toBe("number");
      expect(typeof result.data.role_fit_score).toBe("number");
      expect(typeof result.data.question_fit_score).toBe("number");
    }
  });

  it("rejects scores below 0", () => {
    const invalid = { ...validResponse, persuasiveness_score: -1 };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects scores above 100", () => {
    const invalid = { ...validResponse, star_alignment_score: 101 };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts boundary values 0 and 100", () => {
    const boundary = {
      ...validResponse,
      persuasiveness_score: 0,
      star_alignment_score: 100,
      role_fit_score: 0,
      question_fit_score: 100,
      star_breakdown: { situation: 0, task: 100, action: 0, result: 100 },
    };
    const result = starAnalysisResponseSchema.safeParse(boundary);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const { persuasiveness_score: _, ...missing } = validResponse;
    const result = starAnalysisResponseSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it("rejects suggestions with fewer than 3 items", () => {
    const invalid = { ...validResponse, suggestions: ["only one"] };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects suggestions with more than 5 items", () => {
    const invalid = {
      ...validResponse,
      suggestions: ["a", "b", "c", "d", "e", "f"],
    };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts 3 suggestions (minimum)", () => {
    const valid = { ...validResponse, suggestions: ["a", "b", "c"] };
    const result = starAnalysisResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts 5 suggestions (maximum)", () => {
    const valid = {
      ...validResponse,
      suggestions: ["a", "b", "c", "d", "e"],
    };
    const result = starAnalysisResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects empty suggestion strings", () => {
    const invalid = {
      ...validResponse,
      suggestions: ["", "valid suggestion", "another one"],
    };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing star_breakdown", () => {
    const { star_breakdown: _, ...missing } = validResponse;
    const result = starAnalysisResponseSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it("rejects invalid star_breakdown fields", () => {
    const invalid = {
      ...validResponse,
      star_breakdown: { situation: 110, task: 80, action: 85, result: 85 },
    };
    const result = starAnalysisResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects completely malformed input (string instead of object)", () => {
    const result = starAnalysisResponseSchema.safeParse("not an object");
    expect(result.success).toBe(false);
  });
});
