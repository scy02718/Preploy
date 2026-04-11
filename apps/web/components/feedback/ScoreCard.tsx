"use client";

import { Card, CardContent } from "@/components/ui/card";
import { getScoreColor } from "@/lib/utils";

interface ScoreCardProps {
  score: number;
  summary: string;
}

export function ScoreCard({ score, summary }: ScoreCardProps) {
  const { bg, text, border, label } = getScoreColor(score);

  return (
    <Card className={`${bg} ${border}`}>
      <CardContent className="flex items-center gap-6 p-6">
        <div className="flex flex-col items-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${border} ${bg}`}
          >
            <span className={`text-3xl font-bold ${text}`}>
              {score.toFixed(1)}
            </span>
          </div>
          <span className={`mt-1 text-sm font-medium ${text}`}>{label}</span>
        </div>
        <p className="flex-1 text-sm text-muted-foreground leading-relaxed">{summary}</p>
      </CardContent>
    </Card>
  );
}
