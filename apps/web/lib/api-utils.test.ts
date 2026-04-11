import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "./api-utils";
import { apiRateLimiter } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    apiRateLimiter.clearAll();
  });

  it("returns null when under the limit", () => {
    const result = checkRateLimit("user-1");
    expect(result).toBeNull();
  });

  it("returns a 429 Response when over the limit", () => {
    // Exhaust the default 30 requests
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user-2");
    }
    const result = checkRateLimit("user-2");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("includes Retry-After header when rate limited", async () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user-3");
    }
    const result = checkRateLimit("user-3");
    expect(result!.headers.get("Retry-After")).toBeTruthy();
  });

  it("includes error message in response body", async () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit("user-4");
    }
    const result = checkRateLimit("user-4");
    const body = await result!.json();
    expect(body.error).toMatch(/too many requests/i);
  });
});
