"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OnboardingTour } from "./OnboardingTour";

export interface OnboardingTourLauncherProps {
  totalSessions: number;
  isStatsLoading: boolean;
}

interface UserMeResponse {
  tourCompletedAt: string | null;
  tourSkippedAt: string | null;
}

export function OnboardingTourLauncher({
  totalSessions,
  isStatsLoading,
}: OnboardingTourLauncherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceOpen = searchParams.get("tour") === "1";

  const [run, setRun] = useState(false);
  const [tourData, setTourData] = useState<UserMeResponse | null>(null);
  const [tourDataLoaded, setTourDataLoaded] = useState(false);

  // Fetch /api/users/me to read tour timestamps
  useEffect(() => {
    async function fetchTourStatus() {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data: UserMeResponse = await res.json();
          setTourData(data);
        }
      } catch {
        // Non-critical — if fetch fails, don't show tour
      } finally {
        setTourDataLoaded(true);
      }
    }
    fetchTourStatus();
  }, []);

  // Decide whether to run the tour after all data is ready
  useEffect(() => {
    if (!tourDataLoaded) return;

    let shouldRun = false;

    if (forceOpen) {
      shouldRun = true;
    } else if (isStatsLoading) {
      shouldRun = false;
    } else if (typeof window !== "undefined" && window.innerWidth < 768) {
      shouldRun = false;
    } else if (
      totalSessions === 0 &&
      !tourData?.tourCompletedAt &&
      !tourData?.tourSkippedAt
    ) {
      shouldRun = true;
    }

    if (shouldRun) {
      // Delay 600 ms so the welcome card renders first
      const timer = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(timer);
    }
  }, [tourDataLoaded, forceOpen, isStatsLoading, totalSessions, tourData]);

  async function handleFinish() {
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_completed_at: new Date().toISOString() }),
      });
    } catch {
      // Non-critical
    }
    router.push("/interview/behavioral/setup");
  }

  async function handleSkip() {
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_skipped_at: new Date().toISOString() }),
      });
    } catch {
      // Non-critical
    }
    setRun(false);
  }

  return (
    <OnboardingTour run={run} onFinish={handleFinish} onSkip={handleSkip} />
  );
}
