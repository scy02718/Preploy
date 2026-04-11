/**
 * Simple in-memory token bucket rate limiter.
 * Tracks requests per key (user ID) with a sliding window.
 *
 * Note: This resets on server restart and doesn't share state across
 * serverless instances. For production at scale, use Redis-based rate limiting.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterOptions {
  /** Max requests allowed per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  // Each limiter gets its own store so different routes can have different limits
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  return {
    /**
     * Check if a request is allowed. Returns { allowed, remaining, retryAfterMs }.
     */
    check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now - entry.lastRefill >= options.windowMs) {
        // New window — refill tokens
        store.set(key, { tokens: options.maxRequests - 1, lastRefill: now });
        return { allowed: true, remaining: options.maxRequests - 1, retryAfterMs: 0 };
      }

      if (entry.tokens > 0) {
        entry.tokens -= 1;
        return { allowed: true, remaining: entry.tokens, retryAfterMs: 0 };
      }

      // Rate limited
      const retryAfterMs = options.windowMs - (now - entry.lastRefill);
      return { allowed: false, remaining: 0, retryAfterMs };
    },

    /** Reset a specific key (useful for testing) */
    reset(key: string) {
      store.delete(key);
    },

    /** Clear the entire store (useful for testing) */
    clearAll() {
      store.clear();
    },
  };
}

/**
 * Default rate limiter for API routes: 30 requests per minute per user.
 */
export const apiRateLimiter = createRateLimiter("api", {
  maxRequests: 30,
  windowMs: 60_000,
});
