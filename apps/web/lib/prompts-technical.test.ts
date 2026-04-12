import { describe, it, expect } from "vitest";
import { buildProblemGenerationPrompt } from "./prompts-technical";
import type { TechnicalSessionConfig } from "@interview-assistant/shared";

const baseConfig: TechnicalSessionConfig = {
  interview_type: "leetcode",
  focus_areas: ["arrays", "hash_map"],
  language: "python",
  difficulty: "medium",
};

describe("buildProblemGenerationPrompt", () => {
  it("includes coding problem label for leetcode type", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).toContain("LeetCode-style coding problem");
  });

  it("includes system design label and skips examples instruction for system_design type", () => {
    const prompt = buildProblemGenerationPrompt({
      ...baseConfig,
      interview_type: "system_design",
      focus_areas: ["scalability", "databases"],
    });
    expect(prompt).toContain("system design question");
    expect(prompt).toContain("Do NOT include input/output examples");
    expect(prompt).toContain("empty array");
  });

  it("includes frontend label for frontend type", () => {
    const prompt = buildProblemGenerationPrompt({
      ...baseConfig,
      interview_type: "frontend",
      focus_areas: ["react"],
    });
    expect(prompt).toContain("frontend engineering problem");
  });

  it("includes backend label for backend type", () => {
    const prompt = buildProblemGenerationPrompt({
      ...baseConfig,
      interview_type: "backend",
      focus_areas: ["api_design"],
    });
    expect(prompt).toContain("backend engineering problem");
  });

  it("includes focus areas in the prompt", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).toContain("arrays");
    expect(prompt).toContain("hash_map");
  });

  it("reflects difficulty level in the prompt", () => {
    const easyPrompt = buildProblemGenerationPrompt({
      ...baseConfig,
      difficulty: "easy",
    });
    expect(easyPrompt).toContain("Easy-difficulty");

    const hardPrompt = buildProblemGenerationPrompt({
      ...baseConfig,
      difficulty: "hard",
    });
    expect(hardPrompt).toContain("Hard-difficulty");
  });

  it("includes the target programming language", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).toContain("python");

    const jsPrompt = buildProblemGenerationPrompt({
      ...baseConfig,
      language: "javascript",
    });
    expect(jsPrompt).toContain("javascript");
  });

  it("includes JSON schema instruction", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).toContain("Respond ONLY with valid JSON");
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"difficulty"');
    expect(prompt).toContain('"examples"');
    expect(prompt).toContain('"constraints"');
  });

  it("includes examples instruction for non-system-design types", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).toContain("2-3 examples");
    expect(prompt).toContain("3-5 constraints");
  });

  it("includes additional_instructions when provided", () => {
    const prompt = buildProblemGenerationPrompt({
      ...baseConfig,
      additional_instructions: "Focus on Google-style problems",
    });
    expect(prompt).toContain("Focus on Google-style problems");
    expect(prompt).toContain("Additional instructions");
  });

  it("omits additional_instructions when empty", () => {
    const prompt = buildProblemGenerationPrompt(baseConfig);
    expect(prompt).not.toContain("Additional instructions");
  });
});
