import { describe, it, expect } from "vitest";
import { buildSmartQuestionsPrompt } from "./smart-questions-prompt";

describe("buildSmartQuestionsPrompt", () => {
  it("includes company name for behavioral", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Google",
      questionType: "behavioral",
    });
    expect(prompt).toContain("Google");
    expect(prompt).toContain("behavioral");
  });

  it("includes role when provided", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Meta",
      role: "Senior Software Engineer",
      questionType: "behavioral",
    });
    expect(prompt).toContain("Senior Software Engineer");
  });

  it("includes resume text when provided", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Amazon",
      resumeText: "Led migration project at Acme Corp reducing latency by 40%",
      questionType: "behavioral",
    });
    expect(prompt).toContain("RESUME");
    expect(prompt).toContain("Acme Corp");
    expect(prompt.toLowerCase()).toContain("specific experience");
  });

  it("omits resume section when not provided", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Google",
      questionType: "behavioral",
    });
    expect(prompt).not.toContain("RESUME");
  });

  it("generates technical prompts differently", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Stripe",
      questionType: "technical",
    });
    expect(prompt).toContain("technical");
    expect(prompt).toContain("system design");
  });

  it("includes resume in technical prompts", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Netflix",
      resumeText: "Built distributed caching layer with Redis",
      questionType: "technical",
    });
    expect(prompt).toContain("Redis");
    expect(prompt).toContain("technical background");
  });

  it("combines company + role + resume in one prompt", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Google",
      role: "Staff Engineer",
      resumeText: "10 years experience with distributed systems",
      questionType: "behavioral",
    });
    expect(prompt).toContain("Google");
    expect(prompt).toContain("Staff Engineer");
    expect(prompt).toContain("distributed systems");
  });

  it("truncates long resume text", () => {
    const longResume = "x".repeat(5000);
    const prompt = buildSmartQuestionsPrompt({
      company: "Test",
      resumeText: longResume,
      questionType: "behavioral",
    });
    expect(prompt.length).toBeLessThan(5000);
  });

  it("requests JSON array format", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Test",
      questionType: "behavioral",
    });
    expect(prompt).toContain("JSON array");
  });

  it("includes categories for behavioral", () => {
    const prompt = buildSmartQuestionsPrompt({
      company: "Test",
      questionType: "behavioral",
    });
    expect(prompt).toContain("leadership");
    expect(prompt).toContain("conflict");
  });
});
