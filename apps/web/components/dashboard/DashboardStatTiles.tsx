"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface UsageData {
  plan: string;
  used: number;
  limit: number | null;
}

interface DashboardStatTilesProps {
  totalSessions: number;
  avgScore: number | null;
  thisWeek: number;
  isLoading: boolean;
}

/**
 * DashboardStatTiles — the four top-level stat cards on the dashboard.
 *
 * The fourth tile (monthly sessions) fetches from GET /api/usage/current
 * and shows "Sessions this month" in monthly terms. When limit is null
 * (truly unlimited plan) it renders "Unlimited". Resets on the 1st of
 * each month.
 */
export function DashboardStatTiles({
  totalSessions,
  avgScore,
  thisWeek,
  isLoading,
}: DashboardStatTilesProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage/current");
        if (res.ok && !cancelled) {
          setUsage(await res.json());
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setIsUsageLoading(false);
      }
    }
    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || isUsageLoading) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        data-testid="stat-tiles-skeleton"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <div className="h-9 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const remaining =
    usage === null
      ? null
      : usage.limit === null
        ? null
        : Math.max(0, usage.limit - usage.used);

  const monthlyHeadline =
    usage === null
      ? "--"
      : usage.limit === null
        ? "Unlimited"
        : String(remaining);

  const monthlyDescription =
    usage === null || usage.limit === null
      ? "this month"
      : "sessions left this month";

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
      data-testid="stat-tiles"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{totalSessions}</CardTitle>
          <CardDescription>Total Sessions</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            {avgScore !== null ? avgScore.toFixed(1) : "--"}
          </CardTitle>
          <CardDescription>Average Score</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{thisWeek}</CardTitle>
          <CardDescription>This Week</CardDescription>
        </CardHeader>
      </Card>
      <Card data-testid="stat-tile-monthly">
        <CardHeader>
          <CardTitle
            className="text-3xl"
            data-testid="stat-tile-monthly-value"
            data-testid-remaining="stat-tile-monthly-remaining"
          >
            {monthlyHeadline}
          </CardTitle>
          <CardDescription title="Resets on the 1st of each month">
            {monthlyDescription}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
