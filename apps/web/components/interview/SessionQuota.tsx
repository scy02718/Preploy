"use client";

import { useEffect, useState } from "react";

interface MonthlyUsage {
  plan: string;
  used: number;
  limit: number | null;
}

/**
 * SessionQuota — displays the user's monthly session usage in the interview
 * setup page, so they know how many sessions they have left before starting.
 *
 * Data source: GET /api/usage/current (monthly billing period).
 * The daily fair-use rate limit lives in /api/sessions/quota and is
 * surfaced as a 429 error when the session creation endpoint rejects a
 * request, not here.
 */
export function SessionQuota() {
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage/current");
        if (res.ok) setUsage(await res.json());
      } catch {
        // Non-critical
      } finally {
        setIsLoading(false);
      }
    }
    fetchUsage();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!usage) return null;

  // Truly unlimited plan (limit === null)
  if (usage.limit === null) {
    return (
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Unlimited sessions this month
      </div>
    );
  }

  const remaining = Math.max(0, usage.limit - usage.used);
  const isAtLimit = remaining <= 0;
  const isLow = remaining === 1;

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        isAtLimit
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : isLow
            ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
            : "border-border bg-muted/50 text-muted-foreground"
      }`}
    >
      {isAtLimit ? (
        <>
          Monthly limit reached ({usage.limit}/{usage.limit} sessions used this
          month). Upgrade for more, or try again next month.
        </>
      ) : (
        <>
          {usage.used}/{usage.limit} sessions used this month
          {isLow && " (1 remaining)"}
        </>
      )}
    </div>
  );
}
