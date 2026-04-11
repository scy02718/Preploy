"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineEvent {
  timestamp_ms: number;
  event_type: "speech" | "code_change";
  summary: string;
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
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Session Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto space-y-0">
          {events.map((event, i) => {
            const isSpeech = event.event_type === "speech";
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

                {/* Icon + summary */}
                <div className="flex items-start gap-2 pb-2 min-w-0">
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
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
