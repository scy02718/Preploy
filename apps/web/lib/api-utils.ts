import { NextResponse } from "next/server";
import { apiRateLimiter } from "./rate-limit";

/**
 * Check rate limit for an authenticated user.
 * Returns a 429 response if rate limited, or null if allowed.
 */
export function checkRateLimit(userId: string): NextResponse | null {
  const { allowed, retryAfterMs } = apiRateLimiter.check(userId);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      }
    );
  }

  return null;
}
