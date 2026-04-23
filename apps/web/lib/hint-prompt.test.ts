import { describe, it, expect } from "vitest";
import { buildHintPrompt, HINT_SYSTEM_PROMPT } from "./hint-prompt";

describe("buildHintPrompt", () => {
  const base = {
    problemTitle: "Two Sum",
    problemDescription: "Given an array of integers, return indices of two numbers that add up to a target.",
    code: "def two_sum(nums, target):\n    pass",
    language: "python",
    priorHints: [] as string[],
  };

  it("system prompt contains NEVER and code in prohibition context", () => {
    const { systemPrompt } = buildHintPrompt(base);
    expect(systemPrompt).toContain("NEVER");
    // "NEVER write code" — check both words appear in the prompt
    expect(systemPrompt.toLowerCase()).toContain("code");
  });

  it("system prompt prohibits code fences/blocks", () => {
    const { systemPrompt } = buildHintPrompt(base);
    expect(systemPrompt).toMatch(/code fences|code blocks/i);
  });

  it("user message includes problem title", () => {
    const { userMessage } = buildHintPrompt(base);
    expect(userMessage).toContain("Two Sum");
  });

  it("user message includes problem description", () => {
    const { userMessage } = buildHintPrompt(base);
    expect(userMessage).toContain("Given an array of integers");
  });

  it("user message includes current code and language", () => {
    const { userMessage } = buildHintPrompt(base);
    expect(userMessage).toContain("python");
    expect(userMessage).toContain("def two_sum(nums, target):");
  });

  it("user message has no 'Prior hints' section when priorHints is empty", () => {
    const { userMessage } = buildHintPrompt({ ...base, priorHints: [] });
    expect(userMessage).not.toContain("Prior hints given");
  });

  it("user message includes numbered prior hints when priorHints is non-empty", () => {
    const { userMessage } = buildHintPrompt({
      ...base,
      priorHints: ["Think about hash maps.", "Consider time complexity."],
    });
    expect(userMessage).toContain("Prior hints given");
    expect(userMessage).toContain("1. Think about hash maps.");
    expect(userMessage).toContain("2. Consider time complexity.");
  });

  it("returns the canonical HINT_SYSTEM_PROMPT constant", () => {
    const { systemPrompt } = buildHintPrompt(base);
    expect(systemPrompt).toBe(HINT_SYSTEM_PROMPT);
  });
});
