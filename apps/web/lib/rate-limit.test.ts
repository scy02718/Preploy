import { describe, it, expect, beforeEach } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  const limiter = createRateLimiter("test", {
    maxRequests: 3,
    windowMs: 1000,
  });

  beforeEach(() => {
    limiter.clearAll();
  });

  it("allows requests under the limit", () => {
    const r1 = limiter.check("user-1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("tracks remaining tokens correctly", () => {
    limiter.check("user-1");
    limiter.check("user-1");
    const r3 = limiter.check("user-1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("rejects requests over the limit", () => {
    limiter.check("user-1");
    limiter.check("user-1");
    limiter.check("user-1");
    const r4 = limiter.check("user-1");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks users independently", () => {
    limiter.check("user-1");
    limiter.check("user-1");
    limiter.check("user-1");

    // user-2 should still have full quota
    const r = limiter.check("user-2");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("resets tokens after window expires", async () => {
    // Use a very short window for this test
    const fastLimiter = createRateLimiter("test-fast", {
      maxRequests: 1,
      windowMs: 50,
    });

    fastLimiter.check("user-1");
    const blocked = fastLimiter.check("user-1");
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));

    const afterWindow = fastLimiter.check("user-1");
    expect(afterWindow.allowed).toBe(true);
    fastLimiter.clearAll();
  });

  it("reset() clears a specific user", () => {
    limiter.check("user-1");
    limiter.check("user-1");
    limiter.check("user-1");

    limiter.reset("user-1");
    const r = limiter.check("user-1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("retryAfterMs is within the window size", () => {
    limiter.check("user-1");
    limiter.check("user-1");
    limiter.check("user-1");
    const r = limiter.check("user-1");
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(1000);
  });
});
