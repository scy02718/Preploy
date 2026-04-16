"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BADGES, TIER_META, type BadgeTier } from "@/lib/badges";
import { getBadgeProgress } from "@/lib/badge-checker";

interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
}

interface StatsResponse {
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  highestScore: number | null;
  avgScore: number | null;
  badges: EarnedBadge[];
  hasCompletedBehavioral: boolean;
  hasCompletedTechnical: boolean;
}

const TIER_FILTERS: { value: BadgeTier | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "mastery", label: "Mastery" },
  { value: "fun", label: "Legendary" },
];

export default function AchievementsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<BadgeTier | "all">("all");

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/users/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {TIER_FILTERS.map((f) => (
            <div key={f.value} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const earnedIds = new Set(stats.badges.map((b) => b.badgeId));
  const earnedMap = new Map(stats.badges.map((b) => [b.badgeId, b]));
  const filteredBadges =
    tierFilter === "all"
      ? BADGES
      : BADGES.filter((b) => b.tier === tierFilter);

  // Build a partial stats object for progress bars
  const progressStats = {
    totalSessions: stats.totalSessions,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    // We don't have all fields from the stats endpoint, but progress
    // bars work with what's available
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Achievements</h1>
      <p className="mb-6 text-muted-foreground">
        {earnedIds.size} of {BADGES.length} badges earned
      </p>

      {/* Tier filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TIER_FILTERS.map((f) => {
          const isActive = tierFilter === f.value;
          const tierColor =
            f.value !== "all" ? TIER_META[f.value].color : "";
          return (
            <button
              key={f.value}
              onClick={() => setTierFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : `bg-muted text-muted-foreground hover:text-foreground ${tierColor}`
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filteredBadges.map((badge) => {
          const isEarned = earnedIds.has(badge.id);
          const earned = earnedMap.get(badge.id);
          const tier = TIER_META[badge.tier];
          const progress =
            badge.target !== null
              ? getBadgeProgress(badge.id, progressStats)
              : null;

          return (
            <Card
              key={badge.id}
              className={`transition-all ${
                isEarned
                  ? `${tier.border} ${tier.glow}`
                  : "border-border opacity-50"
              }`}
            >
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <span className={`text-3xl ${!isEarned ? "grayscale" : ""}`}>
                  {badge.icon}
                </span>
                <span className="text-sm font-semibold">{badge.name}</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {isEarned ? badge.description : badge.hint}
                </span>

                {/* Progress bar for numeric badges */}
                {!isEarned && badge.target !== null && progress !== null && (
                  <div className="w-full mt-1">
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary/60 transition-all"
                        style={{
                          width: `${Math.min(100, (progress / badge.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {progress}/{badge.target}
                    </span>
                  </div>
                )}

                {/* Earned date */}
                {isEarned && earned && (
                  <span className="text-[10px] text-muted-foreground">
                    Earned{" "}
                    {new Date(earned.earnedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}

                {/* Tier badge */}
                <span
                  className={`text-[10px] font-medium ${tier.color}`}
                >
                  {tier.label}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
