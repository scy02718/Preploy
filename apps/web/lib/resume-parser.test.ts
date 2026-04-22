/**
 * Unit tests for resume-parser.ts
 *
 * We mock OpenAI so these tests never touch the network. All tests exercise
 * the schema validation and parseResume() logic branches.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock OpenAI before importing the module under test ----
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

import {
  parseResume,
  structuredResumeSchema,
  bulletSchema,
  roleSchema,
} from "./resume-parser";

// Helper to build a mock OpenAI response
function mockOpenAIResponse(content: string) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content } }],
  });
}

// A well-formed structured resume payload
const VALID_PAYLOAD = {
  roles: [
    {
      company: "Acme Corp",
      title: "Software Engineer",
      dates: "2020-2023",
      bullets: [
        {
          text: "Led migration of monolith to microservices, reducing latency by 40%",
          impact_score: 9,
          has_quantified_metric: true,
        },
        {
          text: "Participated in team meetings",
          impact_score: 2,
          has_quantified_metric: false,
        },
      ],
    },
  ],
  skills: ["TypeScript", "Node.js", "Postgres"],
};

describe("structuredResumeSchema", () => {
  it("accepts a valid payload with roles and skills", () => {
    const result = structuredResumeSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts an empty roles array (resume with no detected roles)", () => {
    const result = structuredResumeSchema.safeParse({ roles: [], skills: [] });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer impact_score", () => {
    const payload = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Did stuff", impact_score: 7.5, has_quantified_metric: false }],
        },
      ],
      skills: [],
    };
    const result = structuredResumeSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects impact_score out of range (> 10)", () => {
    const payload = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Did stuff", impact_score: 11, has_quantified_metric: false }],
        },
      ],
      skills: [],
    };
    const result = structuredResumeSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects impact_score below 0", () => {
    const payload = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Did stuff", impact_score: -1, has_quantified_metric: false }],
        },
      ],
      skills: [],
    };
    const result = structuredResumeSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean has_quantified_metric", () => {
    const payload = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Did stuff", impact_score: 5, has_quantified_metric: "yes" }],
        },
      ],
      skills: [],
    };
    const result = structuredResumeSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("bulletSchema", () => {
  it("accepts a valid bullet", () => {
    const result = bulletSchema.safeParse({ text: "Did stuff", impact_score: 5, has_quantified_metric: false });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = bulletSchema.safeParse({ text: "", impact_score: 5, has_quantified_metric: false });
    expect(result.success).toBe(false);
  });
});

describe("roleSchema", () => {
  it("accepts a role with empty bullets array", () => {
    const result = roleSchema.safeParse({ company: "Co", title: "Eng", dates: "2020", bullets: [] });
    expect(result.success).toBe(true);
  });
});

describe("parseResume()", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns null for empty input without calling OpenAI", async () => {
    const result = await parseResume("");
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns null for whitespace-only input without calling OpenAI", async () => {
    const result = await parseResume("   \n\t  ");
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns parsed data on a valid LLM response", async () => {
    mockOpenAIResponse(JSON.stringify(VALID_PAYLOAD));
    const result = await parseResume("Some resume text");
    expect(result).not.toBeNull();
    expect(result!.roles).toHaveLength(1);
    expect(result!.roles[0].company).toBe("Acme Corp");
    expect(result!.skills).toContain("TypeScript");
  });

  it("returns null when LLM returns non-JSON string", async () => {
    mockOpenAIResponse("I cannot parse this resume, please try again.");
    const result = await parseResume("Some resume text");
    expect(result).toBeNull();
  });

  it("returns null when LLM returns JSON that fails schema validation (invalid impact_score)", async () => {
    const badPayload = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Did stuff", impact_score: 15, has_quantified_metric: false }],
        },
      ],
      skills: [],
    };
    mockOpenAIResponse(JSON.stringify(badPayload));
    const result = await parseResume("Some resume text");
    expect(result).toBeNull();
  });

  it("returns null when OpenAI throws an error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("OpenAI API error"));
    const result = await parseResume("Some resume text");
    expect(result).toBeNull();
  });

  it("returns null when OpenAI returns no content", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const result = await parseResume("Some resume text");
    expect(result).toBeNull();
  });

  it("returns null when OpenAI returns empty choices", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });
    const result = await parseResume("Some resume text");
    expect(result).toBeNull();
  });

  it("accepts a payload with empty roles (no roles detected in resume)", async () => {
    mockOpenAIResponse(JSON.stringify({ roles: [], skills: ["JavaScript"] }));
    const result = await parseResume("John Doe, skills: JavaScript");
    expect(result).not.toBeNull();
    expect(result!.roles).toHaveLength(0);
    expect(result!.skills).toContain("JavaScript");
  });
});
