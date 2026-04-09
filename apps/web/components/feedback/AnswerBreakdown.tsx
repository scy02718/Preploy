"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnswerAnalysis {
  question: string;
  answer_summary: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

interface AnswerBreakdownProps {
  analyses: AnswerAnalysis[];
}

function scoreBadgeVariant(score: number) {
  if (score >= 8) return "default";
  if (score >= 5) return "secondary";
  return "destructive";
}

export function AnswerBreakdown({ analyses }: AnswerBreakdownProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Per-Answer Breakdown</h3>
      {analyses.map((a, i) => {
        const isExpanded = expandedIndex === i;
        return (
          <Card key={i}>
            <CardHeader
              className="cursor-pointer p-4"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.question}</p>
                  {!isExpanded && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {a.feedback}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={scoreBadgeVariant(a.score)}>
                    {a.score.toFixed(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3 border-t px-4 pb-4 pt-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Answer Summary
                  </p>
                  <p className="mt-1 text-sm">{a.answer_summary}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Feedback
                  </p>
                  <p className="mt-1 text-sm">{a.feedback}</p>
                </div>

                {a.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Suggestions
                    </p>
                    <ul className="mt-1 space-y-1">
                      {a.suggestions.map((s, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <span className="text-muted-foreground">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
