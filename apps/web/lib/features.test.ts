import { describe, it, expect } from "vitest";
import { hasFeature, FEATURE_MATRIX, FEATURE_META, type FeatureKey } from "./features";

describe("hasFeature", () => {
  it("free plan HAS planner (planner is a Free feature)", () => {
    expect(hasFeature("free", "planner")).toBe(true);
  });

  it("free plan HAS resume (plain resume tooling is a Free feature)", () => {
    expect(hasFeature("free", "resume")).toBe(true);
  });

  it("pro plan HAS planner", () => {
    expect(hasFeature("pro", "planner")).toBe(true);
  });

  it("pro plan HAS resume", () => {
    expect(hasFeature("pro", "resume")).toBe(true);
  });

  it("free plan does NOT have resume_tailored_questions", () => {
    expect(hasFeature("free", "resume_tailored_questions")).toBe(false);
  });

  it("pro plan HAS resume_tailored_questions", () => {
    expect(hasFeature("pro", "resume_tailored_questions")).toBe(true);
  });
});

describe("FEATURE_MATRIX", () => {
  it("every key in FEATURE_MATRIX has a matching FEATURE_META entry", () => {
    for (const key of Object.keys(FEATURE_MATRIX) as FeatureKey[]) {
      expect(FEATURE_META[key]).toBeDefined();
      expect(FEATURE_META[key].label).toBeTruthy();
      expect(FEATURE_META[key].href.startsWith("/")).toBe(true);
      expect(FEATURE_META[key].benefits.length).toBeGreaterThan(0);
    }
  });

  it("planner and resume are available to free users", () => {
    expect(FEATURE_MATRIX["planner"]).toContain("free");
    expect(FEATURE_MATRIX["resume"]).toContain("free");
  });

  it("resume_tailored_questions, follow_up_probing, interviewer_personas, and custom_topic are Pro-only", () => {
    const proOnlyKeys: FeatureKey[] = [
      "resume_tailored_questions",
      "follow_up_probing",
      "interviewer_personas",
      "custom_topic",
    ];
    for (const key of proOnlyKeys) {
      expect(FEATURE_MATRIX[key]).toEqual(["pro"]);
    }
  });
});

describe("follow_up_probing feature (#178)", () => {
  it("pro plan HAS follow_up_probing", () => {
    expect(hasFeature("pro", "follow_up_probing")).toBe(true);
  });

  it("free plan does NOT have follow_up_probing", () => {
    expect(hasFeature("free", "follow_up_probing")).toBe(false);
  });
});

describe("interviewer_personas feature (#179)", () => {
  it("pro plan HAS interviewer_personas", () => {
    expect(hasFeature("pro", "interviewer_personas")).toBe(true);
  });

  it("free plan does NOT have interviewer_personas", () => {
    expect(hasFeature("free", "interviewer_personas")).toBe(false);
  });
});
