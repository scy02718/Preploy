import { describe, it, expect } from "vitest";
import { PLANS, getPlanConfig } from "./plans";

describe("plans", () => {
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

describe("getPlanConfig", () => {
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
