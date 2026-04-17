import { describe, it, expect } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates a basic title", () => {
    expect(slugify("Led Microservices Migration")).toBe("led-microservices-migration");
  });

  it("strips punctuation and collapses runs to a single hyphen", () => {
    expect(slugify("Hello, World! This is a test...")).toBe("hello-world-this-is-a-test");
  });

  it("normalises unicode diacritics (é → e, ñ → n, ü → u)", () => {
    expect(slugify("Café résumé naïve Zürich")).toBe("cafe-resume-naive-zurich");
  });

  it("returns 'story' for an empty string", () => {
    expect(slugify("")).toBe("story");
  });

  it("returns 'story' for a non-string / falsy value", () => {
    // @ts-expect-error intentional bad input
    expect(slugify(null)).toBe("story");
    // @ts-expect-error intentional bad input
    expect(slugify(undefined)).toBe("story");
  });

  it("returns 'story' when input contains only special characters", () => {
    expect(slugify("!!!---???")).toBe("story");
  });

  it("caps output at 60 characters by default", () => {
    const long = "word ".repeat(20).trim(); // 99 chars
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("trims at a hyphen boundary when capping length", () => {
    // 65-char string of alternating word-boundary patterns
    const input = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const result = slugify(input, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).not.toMatch(/^-|-$/);
  });

  it("handles numbers and alphanumeric mixed strings", () => {
    expect(slugify("Led 3 Teams in Q1 2024")).toBe("led-3-teams-in-q1-2024");
  });
});
