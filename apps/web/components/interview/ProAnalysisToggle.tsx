"use client";

import { useState, useEffect, useId } from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/usePlan";

interface ProAnalysisToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

interface UsageData {
  plan: "free" | "pro";
  used: number;
  limit: number;
  periodEnd: string | null;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "next month";
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "next month";
  }
}

export function ProAnalysisToggle({ value, onChange }: ProAnalysisToggleProps) {
  const { plan } = usePlan();
  // null  = fetch not yet resolved (loading)
  // false = fetch errored / non-Pro (show nothing or fallback)
  // UsageData = fetched successfully
  const [usage, setUsage] = useState<UsageData | null | false>(null);
  const switchId = useId();
  const sublineId = useId();

  useEffect(() => {
    // Only fetch for Pro users.
    if (plan !== "pro") return;
    let cancelled = false;
    fetch("/api/users/pro-analysis-usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch pro analysis usage");
        return res.json() as Promise<UsageData>;
      })
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setUsage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plan]);

  // Derive loading: Pro plan but fetch hasn't resolved yet
  const isLoading = plan === "pro" && usage === null;

  // Hidden for Free users
  if (plan !== "pro") return null;

  // Skeleton while loading
  if (isLoading) {
    return (
      <div
        role="group"
        aria-label="Pro analysis toggle loading"
        className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 animate-pulse"
      >
        <div className="mt-0.5 h-4 w-4 rounded bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
        <div className="h-5 w-9 rounded-full bg-muted" />
      </div>
    );
  }

  // usage === false means fetch errored — render nothing rather than a broken state.
  if (usage === false) return null;

  const usageData = usage as UsageData;
  const used = usageData.used;
  const limit = usageData.limit;
  const periodEnd = usageData.periodEnd;
  const isExhausted = limit > 0 && used >= limit;

  if (isExhausted) {
    return (
      <div
        role="group"
        className="rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 px-4 py-3 space-y-2"
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 shrink-0 text-[color:var(--primary)]"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">Pro analysis</span>
        </div>
        <p className="text-sm text-muted-foreground" id={sublineId}>
          You&apos;ve used all {limit} Pro analyses this month. This session
          will use standard analysis. Resets {formatDate(periodEnd)}.
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      className="flex items-start gap-3 rounded-lg border border-border px-4 py-3"
    >
      <Sparkles
        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]"
        aria-hidden="true"
      />
      <div className="flex-1">
        <label
          htmlFor={switchId}
          className="block cursor-pointer text-sm font-medium"
        >
          Use Pro analysis for this session
        </label>
        <p className="text-xs text-muted-foreground" id={sublineId}>
          {used} of {limit} left this month
        </p>
      </div>
      <Switch
        id={switchId}
        checked={value}
        onCheckedChange={onChange}
        aria-describedby={sublineId}
        disabled={isExhausted}
      />
    </div>
  );
}
