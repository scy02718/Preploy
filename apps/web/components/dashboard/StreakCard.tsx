"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface HeatmapDay {
  date: string;
  count: number;
}

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  heatmap: HeatmapDay[];
}

export function StreakCard({
  currentStreak,
  longestStreak,
  heatmap,
}: StreakCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-5 w-5 text-orange-500" />
          Practice Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streak numbers */}
        <div className="flex gap-6">
          <div>
            <p className="text-3xl font-bold">{currentStreak}</p>
            <p className="text-xs text-muted-foreground">Current streak</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-muted-foreground">
              {longestStreak}
            </p>
            <p className="text-xs text-muted-foreground">Longest streak</p>
          </div>
        </div>

        {/* Heatmap */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Last 30 days
          </p>
          <div className="flex gap-0.5 flex-wrap">
            {heatmap.map((day) => (
              <div
                key={day.date}
                className={`h-4 w-4 rounded-sm ${
                  day.count === 0
                    ? "bg-muted"
                    : day.count === 1
                      ? "bg-green-300 dark:bg-green-800"
                      : day.count === 2
                        ? "bg-green-500 dark:bg-green-600"
                        : "bg-green-700 dark:bg-green-400"
                }`}
                title={`${day.date}: ${day.count} session${day.count !== 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
