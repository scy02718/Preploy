"use client";

import { useEffect, useState } from "react";

interface UsageData {
  plan: string;
  used: number;
  limit: number | null;
}

/**
 * SessionCostBanner — cost-aware nudge shown on interview setup pages.
 *
 * Renders a contextual banner based on the user's remaining monthly session
 * quota. Unlimited plans (limit === null) render nothing. On fetch error,
 * renders nothing so the setup flow is never blocked.
 */
export function SessionCostBanner() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage/current");
        if (res.ok) {
          setUsage(await res.json());
        } else {
          setFetchFailed(true);
        }
      } catch {
        setFetchFailed(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUsage();
  }, []);

  // Loading skeleton — mirrors the final shape
  if (isLoading) {
    return (
      <div
        data-testid="session-cost-banner-skeleton"
        className="animate-pulse bg-muted h-12 rounded-md"
      />
    );
  }

  // Graceful degradation on fetch error
  if (fetchFailed || !usage) return null;

  // Unlimited plan — render nothing
  if (usage.limit === null) return null;

  const remaining = Math.max(0, usage.limit - usage.used);

  if (remaining === 0) {
    return (
      <div
        data-testid="session-cost-banner"
        className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        You&apos;ve used all your monthly interviews. Upgrade or wait until next
        month.
      </div>
    );
  }

  if (remaining === 1) {
    return (
      <div
        data-testid="session-cost-banner"
        className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400"
      >
        Heads up — this is your last mock interview this month.
      </div>
    );
  }

  return (
    <div
      data-testid="session-cost-banner"
      className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
    >
      Quick reminder: this will use 1 of your {remaining} remaining mock
      interviews this month.
    </div>
  );
}
