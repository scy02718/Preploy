import { describe, it, expect } from "vitest";
import {
  buildPlanGenerationPrompt,
  calculatePrepDays,
  extractWeakAreas,
  calculateProgress,
} from "./plan-generator";
import type { PlanData } from "./plan-generator";

describe("calculatePrepDays", () => {
  it("returns the number of days between now and interview date", () => {
    const now = new Date("2026-04-01");
    const result = calculatePrepDays("2026-04-08", now);
    expect(result).toBe(7);
  });

  it("returns at least 1 day even if interview is today", () => {
    const now = new Date("2026-04-10");
    const result = calculatePrepDays("2026-04-10", now);
    // Diff is 0, but clamped to 1
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("returns at least 1 day if interview is in the past", () => {
    const now = new Date("2026-04-10");
    const result = calculatePrepDays("2026-04-05", now);
    expect(result).toBe(1);
  });

  it("caps at 30 days for far-off interviews", () => {
    const now = new Date("2026-04-01");
    const result = calculatePrepDays("2026-06-01", now);
    expect(result).toBe(30);
  });
});

describe("buildPlanGenerationPrompt", () => {
  it("includes company and role in the prompt", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Google",
      role: "Senior Software Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).toContain("Google");
    expect(prompt).toContain("Senior Software Engineer");
  });

  it("includes the number of prep days", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Meta",
      role: "Frontend Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).toMatch(/\d+ days? of preparation/);
  });

  it("includes weak areas when provided", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Amazon",
      role: "SDE II",
      interview_date: "2026-04-25",
      weak_areas: ["dynamic programming", "system design scalability"],
    });

    expect(prompt).toContain("dynamic programming");
    expect(prompt).toContain("system design scalability");
    expect(prompt).toContain("weak areas");
  });

  it("does not include weak areas section when none provided", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Netflix",
      role: "Backend Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).not.toContain("weak areas");
  });

  it("does not include weak areas section when empty array provided", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Netflix",
      role: "Backend Engineer",
      interview_date: "2026-04-20",
      weak_areas: [],
    });

    expect(prompt).not.toContain("weak areas");
  });

  it("includes JSON structure format in the prompt", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Apple",
      role: "iOS Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).toContain('"days"');
    expect(prompt).toContain('"focus"');
    expect(prompt).toContain('"topics"');
    expect(prompt).toContain("JSON");
  });

  it("includes guidelines about alternating focus areas", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Stripe",
      role: "Full Stack Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).toContain("Alternate between behavioral and technical");
  });

  it("mentions the last day should be light review", () => {
    const prompt = buildPlanGenerationPrompt({
      company: "Stripe",
      role: "Full Stack Engineer",
      interview_date: "2026-04-20",
    });

    expect(prompt).toContain("last day should be a light review");
  });
});

describe("extractWeakAreas", () => {
  it("returns weaknesses mentioned in 2+ sessions", () => {
    const feedback = [
      { weaknesses: ["time management", "dynamic programming"] },
      { weaknesses: ["dynamic programming", "communication"] },
      { weaknesses: ["dynamic programming", "time management"] },
    ];

    const result = extractWeakAreas(feedback);
    expect(result).toContain("dynamic programming");
    expect(result).toContain("time management");
    expect(result).not.toContain("communication");
  });

  it("returns empty array when no recurring weaknesses", () => {
    const feedback = [
      { weaknesses: ["one"] },
      { weaknesses: ["two"] },
      { weaknesses: ["three"] },
    ];

    const result = extractWeakAreas(feedback);
    expect(result).toEqual([]);
  });

  it("handles missing weaknesses gracefully", () => {
    const feedback = [
      { weaknesses: undefined },
      { weaknesses: null },
      {},
    ] as Array<{ weaknesses?: string[] | unknown }>;

    const result = extractWeakAreas(feedback);
    expect(result).toEqual([]);
  });

  it("normalizes case when counting", () => {
    const feedback = [
      { weaknesses: ["Dynamic Programming"] },
      { weaknesses: ["dynamic programming"] },
    ];

    const result = extractWeakAreas(feedback);
    expect(result).toContain("dynamic programming");
  });

  it("sorts by frequency descending", () => {
    const feedback = [
      { weaknesses: ["a", "b"] },
      { weaknesses: ["a", "b"] },
      { weaknesses: ["a", "c"] },
      { weaknesses: ["b", "c"] },
    ];

    const result = extractWeakAreas(feedback);
    // a=3, b=3, c=2
    expect(result[0]).toBe("a");
    expect(result).toContain("c");
  });
});

describe("calculateProgress", () => {
  it("calculates percentage correctly", () => {
    const plan: PlanData = {
      days: [
        { date: "2026-04-11", focus: "behavioral", topics: ["STAR"], session_type: "behavioral", completed: true },
        { date: "2026-04-12", focus: "technical", topics: ["Arrays"], session_type: "technical", completed: true },
        { date: "2026-04-13", focus: "behavioral", topics: ["Conflict"], session_type: "behavioral", completed: false },
        { date: "2026-04-14", focus: "technical", topics: ["Trees"], session_type: "technical", completed: false },
      ],
    };

    const result = calculateProgress(plan);
    expect(result.completed).toBe(2);
    expect(result.total).toBe(4);
    expect(result.percentage).toBe(50);
  });

  it("returns 0% for empty plan", () => {
    const plan: PlanData = { days: [] };
    const result = calculateProgress(plan);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("returns 100% when all days completed", () => {
    const plan: PlanData = {
      days: [
        { date: "2026-04-11", focus: "behavioral", topics: ["STAR"], session_type: "behavioral", completed: true },
        { date: "2026-04-12", focus: "technical", topics: ["Arrays"], session_type: "technical", completed: true },
      ],
    };

    const result = calculateProgress(plan);
    expect(result.percentage).toBe(100);
  });
});
