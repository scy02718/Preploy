import { describe, it, expect, afterEach, vi } from "vitest";
import { modelFor, FREE_ANALYSIS_MODEL, DEFAULT_PRO_ANALYSIS_MODEL } from "./analysis-model";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("modelFor", () => {
  it("modelFor('free') returns gpt-5.4-mini", () => {
    expect(modelFor("free")).toBe(FREE_ANALYSIS_MODEL);
    expect(modelFor("free")).toBe("gpt-5.4-mini");
  });

  it("modelFor('pro') returns PRO_ANALYSIS_MODEL when set", () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");
    expect(modelFor("pro")).toBe("gpt-5-test-pro");
  });

  it("modelFor('pro') defaults to gpt-5 when env unset", () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", undefined as unknown as string);
    expect(modelFor("pro")).toBe(DEFAULT_PRO_ANALYSIS_MODEL);
    expect(modelFor("pro")).toBe("gpt-5");
  });

  it("modelFor('pro') falls back to gpt-5 when env is empty string", () => {
    vi.stubEnv("PRO_ANALYSIS_MODEL", "");
    expect(modelFor("pro")).toBe(DEFAULT_PRO_ANALYSIS_MODEL);
    expect(modelFor("pro")).toBe("gpt-5");
  });
});
