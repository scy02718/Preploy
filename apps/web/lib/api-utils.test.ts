import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "./api-utils";

// checkRateLimit is now async and delegates to the tiered Redis limiter.
// Without Upstash env vars, it falls back to the in-memory limiter with
// tier-specific defaults. "default" tier = 20 req/min.

describe("checkRateLimit", () => {
  it("returns null when under the limit", async () => {
    const result = await checkRateLimit("test-user-1");
    expect(result).toBeNull();
  });

  it("returns a 429 Response when over the limit", async () => {
    // Exhaust the default tier's 20 requests
    for (let i = 0; i < 20; i++) {
      await checkRateLimit("test-user-2");
    }
    const result = await checkRateLimit("test-user-2");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("includes X-RateLimit headers when rate limited", async () => {
    for (let i = 0; i < 20; i++) {
      await checkRateLimit("test-user-3");
    }
    const result = await checkRateLimit("test-user-3");
    expect(result!.headers.get("Retry-After")).toBeTruthy();
    expect(result!.headers.get("X-RateLimit-Limit")).toBe("20");
    expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("includes error message and tier in response body", async () => {
    for (let i = 0; i < 20; i++) {
      await checkRateLimit("test-user-4");
    }
    const result = await checkRateLimit("test-user-4");
    const body = await result!.json();
    expect(body.error).toMatch(/too many requests/i);
    expect(body.tier).toBe("default");
  });

  it("openai tier has a tighter limit (5/min)", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit("test-user-5", "openai");
      expect(r).toBeNull();
    }
    const result = await checkRateLimit("test-user-5", "openai");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("read tier has a looser limit (60/min)", async () => {
    // Send 25 requests — should all pass under the read tier (60/min)
    for (let i = 0; i < 25; i++) {
      const r = await checkRateLimit("test-user-6", "read");
      expect(r).toBeNull();
    }
  });
});
