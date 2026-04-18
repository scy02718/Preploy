import { describe, it, expect } from "vitest";
import { buildBehavioralSystemPrompt } from "./prompts";
import type { BehavioralSessionConfig } from "@preploy/shared";

const DEFAULT_CONFIG: BehavioralSessionConfig = {
  interview_style: 0.5,
  difficulty: 0.5,
};

describe("buildBehavioralSystemPrompt", () => {
  it("produces a valid prompt with default config (no company, no JD)", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);

    expect(prompt).toContain("experienced hiring manager");
    expect(prompt).toContain("behavioral interview");
    expect(prompt).not.toContain("role at");
    expect(prompt).not.toContain("job description");
  });

  it("includes company name when provided", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      company_name: "Google",
    });

    expect(prompt).toContain("role at Google");
  });

  it("includes job description when provided", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      job_description: "Senior Frontend Engineer building React apps",
    });

    expect(prompt).toContain("Senior Frontend Engineer building React apps");
    expect(prompt).toContain("Tailor your questions");
  });

  it("lists expected questions when provided", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      expected_questions: [
        "Tell me about a time you led a team",
        "Describe a conflict you resolved",
      ],
    });

    expect(prompt).toContain("Tell me about a time you led a team");
    expect(prompt).toContain("Describe a conflict you resolved");
    expect(prompt).toContain("also add your own");
  });

  it("uses formal tone for style=0.0", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      interview_style: 0.0,
    });

    expect(prompt).toContain("formal");
    expect(prompt).not.toContain("casual");
  });

  it("uses casual tone for style=1.0", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      interview_style: 1.0,
    });

    expect(prompt).toContain("casual");
    expect(prompt).toContain("conversational");
  });

  it("uses balanced tone for style=0.5", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      interview_style: 0.5,
    });

    expect(prompt).toContain("balanced");
  });

  it("asks entry-level questions for difficulty=0.0", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      difficulty: 0.0,
    });

    expect(prompt).toContain("entry-level");
  });

  it("asks senior-level questions for difficulty=1.0", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      difficulty: 1.0,
    });

    expect(prompt).toContain("senior");
    expect(prompt).toContain("leadership");
  });

  it("asks mid-level questions for difficulty=0.5", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      difficulty: 0.5,
    });

    expect(prompt).toContain("mid-level");
    expect(prompt).toContain("STAR");
  });

  it("always includes the concise responses constraint", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    // Updated wording per #108 — old "2-3 sentences maximum" replaced
    expect(prompt).toContain("3 sentences for questions");
    expect(prompt).toContain("voice conversation");
  });

  // 108-C: warm-up small talk must always be present (snapshot assertion)
  it("always includes the warm-up small-talk instruction (108-C)", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("1–2 turns of natural small talk");
    expect(prompt).toContain("Never open with a behavioral question cold");
  });

  // 108-D: conciseness cap — 3 sentences for questions, 5 for context
  it("always includes the 3-sentence cap for questions (108-D)", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("3 sentences for questions");
  });

  it("always includes the 5-sentence context-setting allowance (108-D)", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("5 sentences only when setting context");
  });

  // 108-A / 108-B: silence guidance must be present
  it("always includes the do-NOT-advance silence guidance (108-A/B)", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("do NOT advance to a new question");
  });

  // Regression guard: warm-up present even with empty/minimal config
  it("warm-up section present even when company, JD, and resume are all omitted", () => {
    const prompt = buildBehavioralSystemPrompt({ interview_style: 0.5, difficulty: 0.5 });
    expect(prompt).toContain("1–2 turns of natural small talk");
  });

  it("always includes interview flow instructions", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("4-6 behavioral questions");
    expect(prompt).toContain("Do you have any questions for me?");
  });

  it("ignores empty/whitespace-only company name", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      company_name: "   ",
    });

    expect(prompt).not.toContain("role at");
  });

  it("ignores empty/whitespace-only job description", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      job_description: "  \n  ",
    });

    expect(prompt).not.toContain("job description");
    expect(prompt).not.toContain("Tailor your questions");
  });

  it("includes resume text when provided", () => {
    const prompt = buildBehavioralSystemPrompt({
      ...DEFAULT_CONFIG,
      resume_text: "Senior Engineer at Acme Corp. Led a team of 5.",
    });
    expect(prompt).toContain("RESUME");
    expect(prompt).toContain("Acme Corp");
  });

  it("omits resume section when not provided", () => {
    const prompt = buildBehavioralSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).not.toContain("RESUME");
  });
});
