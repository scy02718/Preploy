import { describe, it, expect } from "vitest";
import { TOUR_STEPS, FINAL_STEP_CTA_HREF } from "./tour-steps";

describe("TOUR_STEPS", () => {
  // 118-K: every step has target, title, content
  it("every step has target, title and content", () => {
    for (const step of TOUR_STEPS) {
      expect(step.target).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.content).toBeTruthy();
    }
  });

  // 118-K: targets are unique
  it("step targets are unique", () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    const unique = new Set(targets);
    expect(unique.size).toBe(targets.length);
  });

  it("has exactly 6 steps", () => {
    expect(TOUR_STEPS.length).toBe(6);
  });

  // 118-K: FINAL_STEP_CTA_HREF matches expected value
  it("FINAL_STEP_CTA_HREF equals /interview/behavioral/setup", () => {
    expect(FINAL_STEP_CTA_HREF).toBe("/interview/behavioral/setup");
  });

  // 118-K: tour targets have tour-step selectors matching Sidebar Link hrefs
  it("sidebar link targets include /star, /planner, /resume, /coaching, /interview/behavioral/setup", () => {
    const targets = TOUR_STEPS.map((s) => String(s.target));
    expect(targets.some((t) => t.includes('/star"'))).toBe(true);
    expect(targets.some((t) => t.includes('/planner"'))).toBe(true);
    expect(targets.some((t) => t.includes('/resume"'))).toBe(true);
    expect(targets.some((t) => t.includes('/coaching"'))).toBe(true);
    expect(targets.some((t) => t.includes('/interview/behavioral/setup"'))).toBe(true);
  });

  it("first step targets the welcome card by data-testid", () => {
    const firstTarget = String(TOUR_STEPS[0].target);
    expect(firstTarget).toBe('[data-testid="welcome-card"]');
  });

  it("last step title mentions mock interview", () => {
    const lastStep = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(String(lastStep.title).toLowerCase()).toContain("mock interview");
  });

  it("unlimited feature steps mention 'no quota cost' or 'Unlimited'", () => {
    const starStep = TOUR_STEPS.find((s) => String(s.target).includes('/star"'));
    expect(String(starStep?.content).toLowerCase()).toMatch(/unlimited|no quota cost/i);
  });
});
