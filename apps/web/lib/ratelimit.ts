/**
 * Redis-backed rate limiting via @upstash/ratelimit.
 *
 * Three tiers:
 *   - "default": 20 req/min — most routes
 *   - "read":    60 req/min — GET routes that don't touch OpenAI
 *   - "openai":   5 req/min — OpenAI-calling routes (expensive)
 *
 * Falls back to the existing in-memory limiter when Upstash/Vercel KV
 * env vars are unset (local dev, CI). The fallback logs a `warn` once
 * per process so production doesn't silently fall through.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createRateLimiter } from "./rate-limit";

export type RateLimitTier = "default" | "read" | "openai";

const TIER_CONFIG: Record<RateLimitTier, { requests: number; windowSec: number }> = {
  default: { requests: 20, windowSec: 60 },
  read: { requests: 60, windowSec: 60 },
  openai: { requests: 5, windowSec: 60 },
};

// In-memory fallbacks for when Redis is unavailable (local dev, CI)
const inMemoryFallbacks: Record<RateLimitTier, ReturnType<typeof createRateLimiter>> = {
  default: createRateLimiter("redis-fallback-default", {
    maxRequests: TIER_CONFIG.default.requests,
    windowMs: TIER_CONFIG.default.windowSec * 1000,
  }),
  read: createRateLimiter("redis-fallback-read", {
    maxRequests: TIER_CONFIG.read.requests,
    windowMs: TIER_CONFIG.read.windowSec * 1000,
  }),
  openai: createRateLimiter("redis-fallback-openai", {
    maxRequests: TIER_CONFIG.openai.requests,
    windowMs: TIER_CONFIG.openai.windowSec * 1000,
  }),
};

let redisAvailable: boolean | null = null;
let warnedAboutFallback = false;

function isRedisConfigured(): boolean {
  if (redisAvailable !== null) return redisAvailable;
  redisAvailable = !!(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
  return redisAvailable;
}

const redisLimiters: Partial<Record<RateLimitTier, Ratelimit>> = {};

function getRedisLimiter(tier: RateLimitTier): Ratelimit {
  if (!redisLimiters[tier]) {
    const redis = Redis.fromEnv();
    const config = TIER_CONFIG[tier];
    redisLimiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSec} s`),
      prefix: `ratelimit:${tier}`,
    });
  }
  return redisLimiters[tier];
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given key (usually userId) at the specified tier.
 */
export async function checkTieredRateLimit(
  key: string,
  tier: RateLimitTier = "default"
): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      // Dynamic import to avoid circular dependency
      import("./logger").then(({ logger }) => {
        logger.warn(
          "Redis not configured (UPSTASH_REDIS_REST_URL or KV_REST_API_URL missing). " +
          "Using in-memory rate limiter. This is fine for local dev but NOT for production."
        );
      }).catch(() => {});
    }
    const fallback = inMemoryFallbacks[tier];
    const { allowed, remaining, retryAfterMs } = fallback.check(key);
    return {
      success: allowed,
      limit: TIER_CONFIG[tier].requests,
      remaining,
      reset: Date.now() + retryAfterMs,
    };
  }

  const limiter = getRedisLimiter(tier);
  const result = await limiter.limit(key);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
