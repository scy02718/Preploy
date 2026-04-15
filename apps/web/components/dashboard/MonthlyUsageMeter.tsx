"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageResponse {
  plan: "free" | "pro";
  used: number;
  limit: number | null;
}

/**
 * Dashboard widget that shows "X / Y interviews used this month" for free
 * users only. Pro users render nothing (returns null). Fetches from
 * `GET /api/usage/current`.
 */
export function MonthlyUsageMeter() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage/current");
        if (!res.ok) return;
        const data: UsageResponse = await res.json();
        if (!cancelled) setUsage(data);
      } catch {
        // Silent — meter is non-critical UX.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <Card data-testid="usage-meter-loading">
        <CardContent className="p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  // Pro users (or unknown) get nothing.
  if (!usage || usage.plan === "pro" || usage.limit === null) {
    return null;
  }

  const { used, limit } = usage;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const isAtLimit = used >= limit;

  return (
    <Card data-testid="usage-meter">
      <CardHeader>
        <CardTitle className="text-base">This month&apos;s interviews</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between mb-2">
          <span
            className="text-2xl font-bold tabular-nums"
            data-testid="usage-meter-count"
          >
            {used} / {limit}
          </span>
          {isAtLimit && (
            <span className="text-xs text-destructive font-medium">
              Limit reached
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${
              isAtLimit ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${percent}%` }}
            data-testid="usage-meter-bar"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isAtLimit
            ? "Upgrade to Pro for unlimited practice."
            : `${limit - used} interviews remaining this month.`}
        </p>
      </CardContent>
    </Card>
  );
}
