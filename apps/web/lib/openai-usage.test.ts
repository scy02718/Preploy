import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeCostMillis,
  recordOpenAIUsage,
  OPENAI_MODEL_PRICING,
  OpenAICapError,
  getPerUserDailyCapMillis,
  getGlobalDailyCapMillis,
} from "./openai-usage";

describe("computeCostMillis", () => {
  it("returns 0 for zero tokens", () => {
    expect(computeCostMillis("gpt-5.4-mini", 0, 0)).toBe(0);
  });

  it("computes cost for gpt-5.4-mini input tokens only", () => {
    // 1M input tokens × $0.75/M = $0.75 = 750 millidollars
    expect(computeCostMillis("gpt-5.4-mini", 1_000_000, 0)).toBe(750);
  });

  it("computes cost for gpt-5.4-mini output tokens only", () => {
    // 1M output tokens × $4.5/M = $4.50 = 4500 millidollars
    expect(computeCostMillis("gpt-5.4-mini", 0, 1_000_000)).toBe(4500);
  });

  it("computes a realistic session cost (4000 input + 1500 output)", () => {
    // (4000/1M × $0.75) + (1500/1M × $4.5) = $0.003 + $0.00675 = $0.00975
    // = 9.75 millidollars → ceil → 10
    expect(computeCostMillis("gpt-5.4-mini", 4000, 1500)).toBe(10);
  });

  it("rounds up (ceil) to avoid undercount accumulation", () => {
    // 1 input token: (1/1M × $0.75) = $0.00000075 = 0.00075 millidollars → ceil → 1
    expect(computeCostMillis("gpt-5.4-mini", 1, 0)).toBe(1);
  });

  it("throws for an unknown model", () => {
    expect(() => computeCostMillis("gpt-99-turbo", 100, 100)).toThrow(
      /Unknown model.*gpt-99-turbo/
    );
  });

  it("every model in OPENAI_MODEL_PRICING is callable", () => {
    for (const model of Object.keys(OPENAI_MODEL_PRICING)) {
      const cost = computeCostMillis(model, 1000, 500);
      expect(cost).toBeGreaterThan(0);
    }
  });
});

describe("OpenAICapError", () => {
  it("has the correct name and reason for per_user", () => {
    const err = new OpenAICapError("per_user");
    expect(err.name).toBe("OpenAICapError");
    expect(err.reason).toBe("per_user");
    expect(err.message).toMatch(/per_user/);
  });

  it("has the correct reason for global", () => {
    const err = new OpenAICapError("global");
    expect(err.reason).toBe("global");
  });

  it("is an instance of Error", () => {
    expect(new OpenAICapError("per_user")).toBeInstanceOf(Error);
  });
});

describe("cap constants", () => {
  it("default per-user cap is $2 = 2000 millidollars", () => {
    expect(getPerUserDailyCapMillis()).toBe(2000);
  });

  it("default global cap is $50 = 50000 millidollars", () => {
    expect(getGlobalDailyCapMillis()).toBe(50000);
  });
});

// Mock @/lib/db so recordOpenAIUsage tests don't need a real database
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  }),
});
vi.mock("@/lib/db", () => ({
  get db() {
    return { insert: mockInsert };
  },
}));

describe("recordOpenAIUsage — unknown model guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recordOpenAIUsage skips silently with a warn when model is unknown", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordOpenAIUsage("user-1", "gpt-99-unknown-model", 1000, 500);
    expect(warnSpy).toHaveBeenCalledWith(
      "recordOpenAIUsage: unknown model, skipping",
      { model: "gpt-99-unknown-model" }
    );
    // No DB insert call should have happened
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("computeCostMillis still throws on unknown model (regression guard)", () => {
    expect(() => computeCostMillis("gpt-99-unknown-model", 1000, 500)).toThrow(
      /Unknown model.*gpt-99-unknown-model/
    );
  });
});
