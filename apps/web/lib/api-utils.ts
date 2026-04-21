import { NextResponse } from "next/server";
import { checkTieredRateLimit, type RateLimitTier } from "./ratelimit";
import { getCurrentUserPlan } from "./user-plan";
import { hasFeature, type FeatureKey } from "./features";

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

/**
 * Gate a route on a Pro-tier feature. Returns a 402 `NextResponse` if the
 * current user's plan doesn't unlock the given feature, or `null` if they
 * may proceed.
 *
 * Free users retain read access to their existing data (read-only
 * grandfathering — see `dev_logs/pricing-model.md`), so this guard is
 * applied to write handlers (POST/PATCH/DELETE) rather than GETs.
 *
 * Response shape is stable for UI consumers:
 * ```json
 * { "error": "pro_plan_required", "feature": "planner", "currentPlan": "free" }
 * ```
 * 402 "Payment Required" is the right status — 403 would signal an
 * authorization failure the user can't fix, whereas the fix here is
 * "upgrade your plan."
 */
export async function requireProFeature(
  userId: string,
  feature: FeatureKey
): Promise<NextResponse | null> {
  const plan = await getCurrentUserPlan(userId);
  if (hasFeature(plan, feature)) return null;

  return NextResponse.json(
    {
      error: "pro_plan_required",
      feature,
      currentPlan: plan,
    },
    { status: 402 }
  );
}
