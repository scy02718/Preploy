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
        {/* Pro-tier summaries can run 500–800 words — cap the visible height
            so the card stays compact on the dashboard and the reader can
            scroll within the widget instead of the whole page jumping. */}
        <p className="flex-1 max-h-40 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
          {summary}
        </p>
      </CardContent>
    </Card>
  );
}
