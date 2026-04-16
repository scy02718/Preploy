"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BADGES, TIER_META } from "@/lib/badges";

interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
}

interface BadgeGridProps {
  earnedBadges: EarnedBadge[];
}

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));

  // Show a curated subset on the dashboard — first 12 badges (starter + some growth)
  const displayBadges = BADGES.slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Achievements ({earnedBadges.length}/{BADGES.length})
          </CardTitle>
          <Link
            href="/achievements"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {displayBadges.map((badge) => {
            const isEarned = earnedIds.has(badge.id);
            const tier = TIER_META[badge.tier];
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                  isEarned
                    ? `${tier.border} bg-primary/5 ${tier.glow}`
                    : "border-border bg-muted/30 opacity-40"
                }`}
                title={
                  isEarned
                    ? `Earned: ${badge.description}`
                    : `Locked: ${badge.hint}`
                }
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-xs font-medium">{badge.name}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {badge.description}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
