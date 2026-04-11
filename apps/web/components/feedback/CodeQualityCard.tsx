"use client";

import { Card, CardContent } from "@/components/ui/card";
import { getScoreColor } from "@/lib/utils";

interface CodeQualityCardProps {
  codeQualityScore: number;
  explanationQualityScore: number;
}

function ScoreBadge({
  score,
  label,
  subtitle,
}: {
  score: number;
  label: string;
  subtitle: string;
}) {
  const { bg, text, border } = getScoreColor(score);

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${border} ${bg}`}
      >
        <span className={`text-2xl font-bold ${text}`}>{score.toFixed(1)}</span>
      </div>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground text-center">
        {subtitle}
      </span>
    </div>
  );
}

export function CodeQualityCard({
  codeQualityScore,
  explanationQualityScore,
}: CodeQualityCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-evenly gap-6 p-6">
        <ScoreBadge
          score={codeQualityScore}
          label="Code Quality"
          subtitle="Correctness, efficiency, readability"
        />
        <ScoreBadge
          score={explanationQualityScore}
          label="Explanation Quality"
          subtitle="Clarity, problem decomposition, trade-offs"
        />
      </CardContent>
    </Card>
  );
}
