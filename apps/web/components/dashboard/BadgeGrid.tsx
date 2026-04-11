"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BADGES } from "@/lib/badges";

interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
}

interface BadgeGridProps {
  earnedBadges: EarnedBadge[];
}

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Achievements ({earnedBadges.length}/{BADGES.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {BADGES.map((badge) => {
            const isEarned = earnedIds.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                  isEarned
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30 opacity-40"
                }`}
                title={
                  isEarned
                    ? `Earned: ${badge.description}`
                    : `Locked: ${badge.description}`
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
