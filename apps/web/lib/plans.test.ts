import { describe, it, expect } from "vitest";
import {
  PLANS,
  getPlanConfig,
  PLAN_DEFINITIONS,
  getPlanLimits,
  FREE_PLAN_MONTHLY_INTERVIEW_LIMIT,
} from "./plans";
import type { Plan } from "./plans";

describe("plans (legacy)", () => {
  it("defines three plan tiers", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "pro", "max"]);
  });

  it("free plan has 3 daily sessions", () => {
    expect(PLANS.free.dailySessionLimit).toBe(3);
  });

  it("pro plan has 10 daily sessions", () => {
    expect(PLANS.pro.dailySessionLimit).toBe(10);
  });

  it("max plan has 30 daily sessions", () => {
    expect(PLANS.max.dailySessionLimit).toBe(30);
  });
});

describe("getPlanConfig (legacy)", () => {
  it("returns correct config for known plan", () => {
    expect(getPlanConfig("pro").dailySessionLimit).toBe(10);
  });

  it("falls back to free for unknown plan", () => {
    expect(getPlanConfig("enterprise")).toBe(PLANS.free);
  });

  it("falls back to free for null", () => {
    expect(getPlanConfig(null)).toBe(PLANS.free);
  });

  it("falls back to free for undefined", () => {
    expect(getPlanConfig(undefined)).toBe(PLANS.free);
  });
});

describe("PLAN_DEFINITIONS", () => {
  const plans = Object.values(PLAN_DEFINITIONS);

  it("defines exactly free and pro tiers", () => {
    expect(Object.keys(PLAN_DEFINITIONS)).toEqual(["free", "pro"]);
  });

  it("every plan has a non-empty name", () => {
    for (const plan of plans) {
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  it("every plan id matches its key", () => {
    for (const [key, plan] of Object.entries(PLAN_DEFINITIONS)) {
      expect(plan.id).toBe(key);
    }
  });

  it("every stripePriceEnvKey is unique", () => {
    const keys = plans.map((p) => p.stripePriceEnvKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every stripePriceEnvKey is a non-empty string", () => {
    for (const plan of plans) {
      expect(typeof plan.stripePriceEnvKey).toBe("string");
      expect(plan.stripePriceEnvKey.length).toBeGreaterThan(0);
    }
  });

  it("free plan priceUsd is 0", () => {
    expect(PLAN_DEFINITIONS.free.priceUsd).toBe(0);
  });

  it("pro plan priceUsd is positive", () => {
    expect(PLAN_DEFINITIONS.pro.priceUsd).toBeGreaterThan(0);
  });
});

describe("getPlanLimits", () => {
  it("free plan monthlyInterviews equals FREE_PLAN_MONTHLY_INTERVIEW_LIMIT", () => {
    expect(getPlanLimits("free").monthlyInterviews).toBe(
      FREE_PLAN_MONTHLY_INTERVIEW_LIMIT
    );
  });

  it("free plan monthlyInterviews is 3", () => {
    expect(getPlanLimits("free").monthlyInterviews).toBe(3);
  });

  it("pro plan monthlyInterviews is null (unlimited)", () => {
    expect(getPlanLimits("pro").monthlyInterviews).toBeNull();
  });

  it("free plan dailySessions is a positive number", () => {
    expect(getPlanLimits("free").dailySessions).toBeGreaterThan(0);
  });

  it("pro plan dailySessions is greater than free plan dailySessions", () => {
    expect(getPlanLimits("pro").dailySessions).toBeGreaterThan(
      getPlanLimits("free").dailySessions
    );
  });

  it("returns the correct limits object for each plan", () => {
    const freeLimits = getPlanLimits("free");
    expect(freeLimits).toEqual(PLAN_DEFINITIONS.free.limits);

    const proLimits = getPlanLimits("pro");
    expect(proLimits).toEqual(PLAN_DEFINITIONS.pro.limits);
  });
});

describe("FREE_PLAN_MONTHLY_INTERVIEW_LIMIT", () => {
  it("is a positive number", () => {
    expect(FREE_PLAN_MONTHLY_INTERVIEW_LIMIT).toBeGreaterThan(0);
  });

  it("matches the free plan limits monthlyInterviews", () => {
    expect(FREE_PLAN_MONTHLY_INTERVIEW_LIMIT).toBe(
      PLAN_DEFINITIONS.free.limits.monthlyInterviews
    );
  });
});

describe("Plan type safety", () => {
  it("free is a valid Plan value", () => {
    const plan: Plan = "free";
    expect(plan).toBe("free");
  });

  it("pro is a valid Plan value", () => {
    const plan: Plan = "pro";
    expect(plan).toBe("pro");
  });
});
