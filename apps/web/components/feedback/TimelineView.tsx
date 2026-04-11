"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface TimelineEvent {
  timestamp_ms: number;
  event_type: "speech" | "code_change";
  summary: string;
  code?: string | null;
  full_text?: string | null;
}

interface TimelineViewProps {
  events: TimelineEvent[];
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TimelineView({ events }: TimelineViewProps) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  if (events.length === 0) return null;

  function toggleExpanded(index: number) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Session Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] overflow-y-auto space-y-0">
          {events.map((event, i) => {
            const isSpeech = event.event_type === "speech";
            const hasCode = !isSpeech && !!event.code;
            const hasFullText = isSpeech && !!event.full_text;
            const isExpandable = hasCode || hasFullText;
            const isExpanded = expandedSet.has(i);

            return (
              <div key={i} className="flex gap-3 py-2">
                {/* Timestamp */}
                <span className="w-12 shrink-0 text-xs font-mono text-muted-foreground pt-0.5">
                  {formatTime(event.timestamp_ms)}
                </span>

                {/* Vertical line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      isSpeech
                        ? "border-blue-400 bg-blue-100 dark:bg-blue-900"
                        : "border-green-400 bg-green-100 dark:bg-green-900"
                    }`}
                  />
                  {i < events.length - 1 && (
                    <div className="w-px flex-1 bg-border" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-sm pt-0.5">
                      {isSpeech ? "\uD83D\uDCAC" : "\uD83D\uDCBB"}
                    </span>
                    <span
                      className={`text-sm ${
                        isSpeech
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-green-700 dark:text-green-300"
                      }`}
                    >
                      {event.summary}
                    </span>
                    {isExpandable && (
                      <button
                        onClick={() => toggleExpanded(i)}
                        className="ml-auto shrink-0 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {hasCode ? "Code" : "More"}
                      </button>
                    )}
                  </div>

                  {/* Expandable code block */}
                  {hasCode && isExpanded && (
                    <pre className="mt-2 max-h-60 overflow-auto rounded-md border bg-muted/50 p-3 text-xs font-mono leading-relaxed">
                      <code>{event.code}</code>
                    </pre>
                  )}

                  {/* Expandable full speech text */}
                  {hasFullText && isExpanded && (
                    <p className="mt-2 rounded-md border bg-muted/30 p-3 text-sm leading-relaxed text-foreground/80">
                      {event.full_text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
