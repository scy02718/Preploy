"use client";

import { Card, CardContent } from "@/components/ui/card";

interface ScoreCardProps {
  score: number;
  summary: string;
}

function getScoreColor(score: number) {
  if (score >= 9) return { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30", label: "Excellent" };
  if (score >= 7) return { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/30", label: "Good" };
  if (score >= 4) return { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "border-yellow-500/30", label: "Average" };
  return { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/30", label: "Needs Work" };
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
