import { describe, it, expect } from "vitest";
import { hasFeature, FEATURE_MATRIX, FEATURE_META, type FeatureKey } from "./features";

describe("hasFeature", () => {
  it("free plan does NOT have planner", () => {
    expect(hasFeature("free", "planner")).toBe(false);
  });

  it("free plan does NOT have resume", () => {
    expect(hasFeature("free", "resume")).toBe(false);
  });

  it("pro plan HAS planner", () => {
    expect(hasFeature("pro", "planner")).toBe(true);
  });

  it("pro plan HAS resume", () => {
    expect(hasFeature("pro", "resume")).toBe(true);
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

  it("every gated feature is Pro-only in the current policy", () => {
    // If this test fails, the product decision changed — re-read
    // dev_logs/pricing-model.md before loosening it.
    for (const key of Object.keys(FEATURE_MATRIX) as FeatureKey[]) {
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
