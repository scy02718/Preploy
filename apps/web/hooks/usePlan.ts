"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import type { Plan } from "@/lib/plans";

const PLAN_CACHE_KEY = "preploy:plan"; // values: "free" | "pro"

/**
 * Returns the current user's plan, fetched once per session.
 *
 * - First render with no cached value fires exactly one fetch to /api/users/me.
 * - Subsequent renders read from sessionStorage — no additional fetch.
 * - Returns `undefined` while loading (callers should render nothing, not a placeholder).
 * - On non-200 or network error, leaves state undefined and does NOT cache,
 *   so a later mount can retry.
 */
export function usePlan(): { plan: Plan | undefined } {
  const [plan, setPlan] = useState<Plan | undefined>(() => {
    // Read sessionStorage synchronously on mount (guards SSR via window check)
    if (typeof window === "undefined") return undefined;
    const cached = sessionStorage.getItem(PLAN_CACHE_KEY);
    if (cached === "pro" || cached === "free") return cached;
    return undefined;
  });

  useEffect(() => {
    // If we already have a plan from the cache, skip the fetch
    if (plan !== undefined) return;

    let cancelled = false;

    fetch("/api/users/me")
      .then((res) => {
        if (!res.ok) return undefined;
        return res.json() as Promise<{ plan?: string }>;
      })
      .then((data) => {
        if (cancelled || data === undefined) return;
        // Normalize: "max" or "pro" → "pro", anything else → "free"
        // Mirrors lib/user-plan.ts coercion
        const normalized: Plan =
          data.plan === "max" || data.plan === "pro" ? "pro" : "free";
        if (typeof window !== "undefined") {
          sessionStorage.setItem(PLAN_CACHE_KEY, normalized);
        }
        setPlan(normalized);
      })
      .catch(() => {
        // Network error — leave state undefined, do NOT cache
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — we only fetch once per mount

  return { plan };
}

/**
 * Removes the cached plan from sessionStorage so the next usePlan() call
 * will re-fetch from the server.
 */
export function clearPlanCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PLAN_CACHE_KEY);
}

/**
 * Clears the plan cache and then delegates to next-auth's signOut.
 * Cache is cleared BEFORE signOut so the hook can't read a stale value
 * on any screen that renders between signOut() being called and the
 * callbackUrl redirect completing.
 */
export function signOutAndClearPlan(
  options?: Parameters<typeof signOut>[0]
): ReturnType<typeof signOut> {
  clearPlanCache();
  return signOut(options);
}
