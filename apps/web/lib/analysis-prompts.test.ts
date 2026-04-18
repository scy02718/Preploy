import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBehavioralPrompt,
  buildTechnicalPrompt,
  type BehavioralPromptConfig,
  type TechnicalPromptConfig,
  type PreparedStarStory,
} from "./analysis-prompts";
import type {
  CodeSnapshotInput,
  TranscriptEntryInput,
} from "./validations";

// ---- Canonical fixtures (mirror Python tests one-for-one) ----

const SAMPLE_TRANSCRIPT: TranscriptEntryInput[] = [
  { speaker: "ai", text: "Tell me about a time you led a team.", timestamp_ms: 0 },
  {
    speaker: "user",
    text: "At my previous company, I led a team of 5 engineers to ship a new feature in 3 weeks.",
    timestamp_ms: 5000,
  },
  { speaker: "ai", text: "What challenges did you face?", timestamp_ms: 15000 },
  {
    speaker: "user",
    text: "We had tight deadlines and had to cut some scope. I facilitated a prioritization session.",
    timestamp_ms: 20000,
  },
];

const SAMPLE_CONFIG: BehavioralPromptConfig = {
  company_name: "Google",
  job_description: "Senior Software Engineer",
  difficulty: 0.8,
};

const TECH_TRANSCRIPT: TranscriptEntryInput[] = [
  { speaker: "user", text: "I'll use a sliding window approach.", timestamp_ms: 1000 },
  { speaker: "user", text: "The time complexity is O(n).", timestamp_ms: 5000 },
];

const TECH_SNAPSHOTS: CodeSnapshotInput[] = [
  { code: "def solution(): pass", language: "python", timestamp_ms: 500, event_type: "edit" },
  {
    code: "def solution(nums):\n    return max(nums)",
    language: "python",
    timestamp_ms: 8000,
    event_type: "edit",
  },
];

const TECH_CONFIG: TechnicalPromptConfig = {
  interview_type: "leetcode",
  focus_areas: ["arrays", "sliding_window"],
  difficulty: "medium",
  language: "python",
};

// ---- buildBehavioralPrompt ----

describe("buildBehavioralPrompt", () => {
  it("includes company name", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).toContain("Company: Google");
  });

  it("includes job description", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).toContain("Senior Software Engineer");
  });

  it("maps difficulty 0.8 to Senior/Staff", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).toContain("Interview level: Senior/Staff");
  });

  it("maps difficulty 0.2 to Entry-level", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, { difficulty: 0.2 });
    expect(prompt).toContain("Entry-level");
  });

  it("maps difficulty 0.5 to Mid-level", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, { difficulty: 0.5 });
    expect(prompt).toContain("Mid-level");
  });

  it("defaults missing difficulty to Mid-level", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, {});
    expect(prompt).toContain("Mid-level");
  });

  it("treats boundary 0.3 as Entry-level (<= 0.3)", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, { difficulty: 0.3 });
    expect(prompt).toContain("Entry-level");
  });

  it("treats boundary 0.7 as Senior/Staff (>= 0.7)", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, { difficulty: 0.7 });
    expect(prompt).toContain("Senior/Staff");
  });

  it("maps speaker labels (ai → Interviewer, user → Candidate)", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).toContain("Interviewer: Tell me about a time");
    expect(prompt).toContain("Candidate: At my previous company");
  });

  it("omits company line when company_name is missing", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, {});
    expect(prompt).not.toContain("Company:");
  });

  it("contains transcript markers", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).toContain("--- TRANSCRIPT ---");
    expect(prompt).toContain("--- END TRANSCRIPT ---");
  });

  it("byte-equivalent to Python _build_analysis_prompt for canonical fixture", () => {
    const expected = readFileSync(
      join(__dirname, "__fixtures__", "behavioral-prompt.expected.txt"),
      "utf-8",
    );
    const actual = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(actual).toBe(expected);
  });

  it("without preparedStory is byte-identical to baseline (no drift section)", () => {
    const withoutStory = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    const alsoWithoutStory = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, undefined);
    expect(withoutStory).toBe(alsoWithoutStory);
  });
});

// ---- buildBehavioralPrompt with preparedStory (drift analysis) ----

const SAMPLE_STAR_STORY: PreparedStarStory = {
  situation: "Our production system experienced a critical outage.",
  task: "I needed to coordinate the on-call engineers to restore service.",
  action: "I set up a war room, assigned roles, and led the post-mortem.",
  result: "We restored service in 2 hours and reduced future incidents by 40%.",
};

describe("buildBehavioralPrompt with preparedStory", () => {
  it("includes PREPARED STAR STORY markers when preparedStory provided", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("--- PREPARED STAR STORY ---");
    expect(prompt).toContain("--- END PREPARED STAR STORY ---");
  });

  it("includes all four STAR sections from the story", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("Situation: Our production system");
    expect(prompt).toContain("Task: I needed to coordinate");
    expect(prompt).toContain("Action: I set up a war room");
    expect(prompt).toContain("Result: We restored service");
  });

  it("includes drift_analysis instruction in prompt", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("drift_analysis");
  });

  it("includes guardrail: Return empty arrays when drift is minimal — no forcing 3 bullets", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("Return empty arrays when drift is minimal — no forcing 3 bullets");
  });

  it("includes guardrail: Only flag drift that's meaningful for answer quality (not tiny paraphrasing)", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("Only flag drift that's meaningful for answer quality (not tiny paraphrasing)");
  });

  it("includes guardrail: Do not invent drift that isn't there", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    expect(prompt).toContain("Do not invent drift that isn't there");
  });

  it("still includes TRANSCRIPT section after STAR story section", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG, SAMPLE_STAR_STORY);
    const starEndIdx = prompt.indexOf("--- END PREPARED STAR STORY ---");
    const transcriptIdx = prompt.indexOf("--- TRANSCRIPT ---");
    expect(starEndIdx).toBeLessThan(transcriptIdx);
  });

  it("prompt without story does NOT contain PREPARED STAR STORY section", () => {
    const prompt = buildBehavioralPrompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG);
    expect(prompt).not.toContain("--- PREPARED STAR STORY ---");
    expect(prompt).not.toContain("drift_analysis");
  });
});

// ---- buildTechnicalPrompt ----

describe("buildTechnicalPrompt", () => {
  it("includes interview type", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt.toLowerCase()).toContain("leetcode");
  });

  it("includes capitalized difficulty", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("Medium");
  });

  it("includes language", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt.toLowerCase()).toContain("python");
  });

  it("includes title-cased focus areas", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("Arrays");
    expect(prompt).toContain("Sliding Window");
  });

  it("includes final code", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("max(nums)");
  });

  it("includes transcript text", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("sliding window approach");
  });

  it("uses Candidate label for user speaker", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("Candidate:");
  });

  it("handles empty snapshots gracefully", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, [], TECH_CONFIG);
    expect(prompt).toContain("No code was written");
  });

  it("includes all snapshots with timestamps and labels", () => {
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(prompt).toContain("Snapshot 1");
    expect(prompt).toContain("FINAL SUBMISSION");
    expect(prompt).toContain("def solution(): pass");
    expect(prompt).toContain("max(nums)");
  });

  it("formats mm:ss timestamps with zero padding", () => {
    const prompt = buildTechnicalPrompt(
      TECH_TRANSCRIPT,
      [
        { code: "x", language: "python", timestamp_ms: 65000, event_type: "edit" },
        { code: "y", language: "python", timestamp_ms: 125000, event_type: "edit" },
      ],
      TECH_CONFIG,
    );
    expect(prompt).toContain("01:05");
    expect(prompt).toContain("02:05");
  });

  it("supports system_design / hard config", () => {
    const config: TechnicalPromptConfig = {
      interview_type: "system_design",
      focus_areas: ["scalability"],
      difficulty: "hard",
      language: "any",
    };
    const prompt = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, config);
    expect(prompt.toLowerCase()).toContain("system_design");
    expect(prompt).toContain("Hard");
  });

  it("byte-equivalent to Python build_technical_analysis_prompt for canonical fixture", () => {
    const expected = readFileSync(
      join(__dirname, "__fixtures__", "technical-prompt.expected.txt"),
      "utf-8",
    );
    const actual = buildTechnicalPrompt(TECH_TRANSCRIPT, TECH_SNAPSHOTS, TECH_CONFIG);
    expect(actual).toBe(expected);
  });
});
