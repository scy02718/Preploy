import { describe, it, expect } from "vitest";
import {
  buildStarAnalysisPrompt,
  STAR_ANALYSIS_MODEL,
  STAR_ANALYSIS_SYSTEM_PROMPT,
  type StarStoryInput,
} from "./star-prompt-builder";

const baseStory: StarStoryInput = {
  title: "Led migration to microservices",
  role: "Senior Software Engineer",
  expectedQuestions: [
    "Tell me about a time you led a major technical initiative",
  ],
  situation:
    "Our monolith was causing 2-hour deploy cycles and blocking 5 teams.",
  task: "I was tasked with designing and leading a 3-month migration to microservices.",
  action:
    "I broke the system into 8 services, created migration runbooks, and trained the team.",
  result:
    "Deploy cycles dropped to 10 minutes, team velocity increased by 40%.",
};

describe("buildStarAnalysisPrompt", () => {
  it("includes the story title in the output", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain("Led migration to microservices");
  });

  it("includes the role in the output", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain("Senior Software Engineer");
  });

  it("includes all STAR sections", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain("SITUATION:");
    expect(prompt).toContain("TASK:");
    expect(prompt).toContain("ACTION:");
    expect(prompt).toContain("RESULT:");
  });

  it("includes expected questions when provided", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain(
      "Tell me about a time you led a major technical initiative"
    );
  });

  it("handles multiple expected questions with numbering", () => {
    const story = {
      ...baseStory,
      expectedQuestions: [
        "Tell me about leadership",
        "Describe a technical challenge",
        "How do you handle failure",
      ],
    };
    const prompt = buildStarAnalysisPrompt(story);
    expect(prompt).toContain("1. Tell me about leadership");
    expect(prompt).toContain("2. Describe a technical challenge");
    expect(prompt).toContain("3. How do you handle failure");
  });

  it("handles empty expectedQuestions gracefully", () => {
    const story = { ...baseStory, expectedQuestions: [] };
    const prompt = buildStarAnalysisPrompt(story);
    expect(prompt).not.toContain("Expected interview questions");
    // still has the story content
    expect(prompt).toContain("SITUATION:");
  });

  it("includes the STAR situation text in the prompt", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain(
      "Our monolith was causing 2-hour deploy cycles and blocking 5 teams."
    );
  });

  it("includes the STAR result text in the prompt", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt).toContain(
      "Deploy cycles dropped to 10 minutes, team velocity increased by 40%."
    );
  });

  it("instructs to return only JSON with no markdown", () => {
    const prompt = buildStarAnalysisPrompt(baseStory);
    expect(prompt.toLowerCase()).toContain("return only the json");
  });

  it("works for an entry-level story (different role and shorter content)", () => {
    const entryLevelStory: StarStoryInput = {
      title: "Fixed production bug under pressure",
      role: "Junior Developer",
      expectedQuestions: ["Tell me about a time you handled a stressful situation"],
      situation: "A critical bug brought down checkout for 30 minutes.",
      task: "I needed to identify and fix the bug within 1 hour.",
      action: "I traced the logs, identified a null pointer, and deployed a hotfix.",
      result: "Checkout was restored in 45 minutes with no data loss.",
    };
    const prompt = buildStarAnalysisPrompt(entryLevelStory);
    expect(prompt).toContain("Junior Developer");
    expect(prompt).toContain("Fixed production bug under pressure");
    expect(prompt).toContain("SITUATION:");
  });

  it("works for a management-level story with multiple questions", () => {
    const managerStory: StarStoryInput = {
      title: "Rebuilt engineering culture after acquisition",
      role: "VP of Engineering",
      expectedQuestions: [
        "How do you handle organizational change?",
        "Tell me about a time you scaled a team",
      ],
      situation: "Post-acquisition, two engineering cultures needed to merge.",
      task: "My task was to unify 40 engineers under a single process.",
      action:
        "Ran listening tours, identified common ground, merged processes incrementally.",
      result: "Team satisfaction scores increased from 58 to 82 in 6 months.",
    };
    const prompt = buildStarAnalysisPrompt(managerStory);
    expect(prompt).toContain("VP of Engineering");
    expect(prompt).toContain("1. How do you handle organizational change?");
    expect(prompt).toContain("2. Tell me about a time you scaled a team");
  });
});

describe("STAR_ANALYSIS_MODEL", () => {
  it("is a non-empty string", () => {
    expect(typeof STAR_ANALYSIS_MODEL).toBe("string");
    expect(STAR_ANALYSIS_MODEL.length).toBeGreaterThan(0);
  });
});

describe("STAR_ANALYSIS_SYSTEM_PROMPT", () => {
  it("includes JSON schema instructions", () => {
    expect(STAR_ANALYSIS_SYSTEM_PROMPT.toLowerCase()).toContain("json");
  });

  it("mentions the key score fields", () => {
    expect(STAR_ANALYSIS_SYSTEM_PROMPT).toContain("persuasiveness_score");
    expect(STAR_ANALYSIS_SYSTEM_PROMPT).toContain("star_alignment_score");
    expect(STAR_ANALYSIS_SYSTEM_PROMPT).toContain("suggestions");
  });
});
