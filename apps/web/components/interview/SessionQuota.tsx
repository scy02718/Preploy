"use client";

import { useEffect, useState } from "react";

interface Quota {
  plan: string;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
}

export function SessionQuota() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch("/api/sessions/quota");
        if (res.ok) setQuota(await res.json());
      } catch {
        // Non-critical
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuota();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!quota) return null;

  const isAtLimit = quota.remaining <= 0;
  const isLow = quota.remaining === 1;

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
          Daily session limit reached ({quota.limit}/{quota.limit} on{" "}
          {quota.planName} plan). Try again tomorrow.
        </>
      ) : (
        <>
          {quota.used}/{quota.limit} sessions used today — {quota.planName} plan
          {isLow && " (1 remaining)"}
        </>
      )}
    </div>
  );
}
