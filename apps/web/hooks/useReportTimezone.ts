"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const TZ_CACHE_KEY = "preploy:tz";

/**
 * Reports the user's IANA timezone to the server so time-of-day
 * achievements (early_bird, night_owl, marathon_runner) use the user's
 * local clock. The detected zone is cached in sessionStorage so we don't
 * PATCH `/api/users/me` on every page navigation — only when it changes
 * (user moved, VPN flip, etc.) or on first sign-in in this tab.
 *
 * Mount this hook once from a component that renders on every authenticated
 * page (`Header` is the chosen site). It is a no-op for unauthenticated
 * sessions and a no-op when `Intl.DateTimeFormat().resolvedOptions()` is
 * unavailable (e.g. very old browsers).
 */
export function useReportTimezone(): void {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;

    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    const cached = window.sessionStorage.getItem(TZ_CACHE_KEY);
    if (cached === tz) return;

    // Fire-and-forget. A failed PATCH is not worth surfacing — achievement
    // checks fall back to UTC until the next successful report.
    fetch("/api/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    })
      .then((res) => {
        if (res.ok) {
          window.sessionStorage.setItem(TZ_CACHE_KEY, tz!);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [status]);
}
