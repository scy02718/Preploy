import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots()", () => {
  it("returns a robots object", () => {
    const result = robots();
    expect(result).toBeDefined();
    expect(result.rules).toBeDefined();
  });

  it("has exactly one rule entry covering all user agents", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const rule = rules[0];
    expect(rule.userAgent).toBe("*");
  });

  it("allows the landing page /", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const allowed = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    expect(allowed).toContain("/");
  });

  it("allows the login page /login", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const allowed = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    expect(allowed).toContain("/login");
  });

  it("disallows /dashboard", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/dashboard");
  });

  it("disallows /interview/ (catches all sub-paths)", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/interview/");
  });

  it("disallows /planner", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/planner");
  });

  it("disallows /profile", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/profile");
  });

  it("disallows /resume", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/resume");
  });

  it("disallows /api/ to prevent API endpoint crawling", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const rule = rules[0];
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallowed).toContain("/api/");
  });

  it("points to the sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toBeDefined();
    expect(typeof result.sitemap === "string" ? result.sitemap : (result.sitemap as string[])[0]).toContain("/sitemap.xml");
  });

  it("sitemap URL is an absolute URL", () => {
    const result = robots();
    const sitemapUrl = typeof result.sitemap === "string" ? result.sitemap : (result.sitemap as string[])[0];
    expect(sitemapUrl).toMatch(/^https?:\/\//);
  });
});
