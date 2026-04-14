import { describe, it, expect } from "vitest";
import { isTechnicalFeedbackComplete } from "./feedback-utils";

describe("isTechnicalFeedbackComplete", () => {
  it("returns true when all three technical fields are populated", () => {
    const row = {
      codeQualityScore: 6.5,
      explanationQualityScore: 8.0,
      timelineAnalysis: [
        { timestamp_ms: 0, event_type: "speech", summary: "Explained" },
      ],
    };
    expect(isTechnicalFeedbackComplete(row)).toBe(true);
  });

  it("returns false when codeQualityScore is null", () => {
    const row = {
      codeQualityScore: null,
      explanationQualityScore: 8.0,
      timelineAnalysis: [{ timestamp_ms: 0 }],
    };
    expect(isTechnicalFeedbackComplete(row)).toBe(false);
  });

  it("returns false when explanationQualityScore is null", () => {
    const row = {
      codeQualityScore: 6.5,
      explanationQualityScore: null,
      timelineAnalysis: [{ timestamp_ms: 0 }],
    };
    expect(isTechnicalFeedbackComplete(row)).toBe(false);
  });

  it("returns false when timelineAnalysis is null", () => {
    const row = {
      codeQualityScore: 6.5,
      explanationQualityScore: 8.0,
      timelineAnalysis: null,
    };
    expect(isTechnicalFeedbackComplete(row)).toBe(false);
  });
});
