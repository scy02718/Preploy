import { NextResponse } from "next/server";
import { checkTieredRateLimit, type RateLimitTier } from "./ratelimit";

/**
 * Check rate limit for an authenticated user. Now async — all callers
 * must `await` the result. Returns a 429 NextResponse if rate-limited,
 * or null if allowed.
 *
 * @param userId  The authenticated user's ID (or a synthetic key like
 *                "cron-cleanup-sessions" for background jobs).
 * @param tier    Optional tier — "default" (20/min), "read" (60/min),
 *                or "openai" (5/min). Defaults to "default".
 */
export async function checkRateLimit(
  userId: string,
  tier?: RateLimitTier
): Promise<NextResponse | null> {
  const result = await checkTieredRateLimit(userId, tier);

  if (!result.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        tier: tier ?? "default",
        reset: result.reset,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.reset),
        },
      }
    );
  }

  return null;
}
