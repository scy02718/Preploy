"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGazeScoreColor } from "@/lib/utils";
import type { GazeDistribution, GazeTimelineBucket } from "@/lib/gaze-metrics";

interface GazePresenceCardProps {
  gazeConsistencyScore: number | null;
  gazeDistribution: GazeDistribution | null;
  gazeCoverage: number | null;
  gazeTimeline: GazeTimelineBucket[] | null;
  isLoading?: boolean;
}

function zoneColor(zone: string): string {
  switch (zone) {
    case "center":
      return "bg-green-500";
    case "up":
      return "bg-blue-500";
    case "down":
      return "bg-orange-500";
    case "left":
    case "right":
      return "bg-purple-500";
    default:
      return "bg-gray-400";
  }
}

function interpretiveCopy(score: number): string {
  if (score >= 80) return "Strong eye contact throughout";
  if (score >= 60) return "Good eye contact with some wandering";
  if (score >= 40) return "Mixed eye contact — try focusing on the camera";
  return "Your gaze wandered frequently — practice looking at the camera";
}

function buildTips(dist: GazeDistribution): string[] {
  const tips: string[] = [];

  if (dist.off_screen_pct > 20) {
    tips.push("Try placing notes near your camera so you can glance at them without looking away.");
  }
  if (dist.down_pct > 30) {
    tips.push("Try to look up at the camera more often — it projects confidence.");
  }
  if (dist.left_pct + dist.right_pct > 30) {
    tips.push("Keep your eyes facing forward toward the camera to appear more confident.");
  }
  if (dist.up_pct > 20) {
    tips.push("Looking up frequently can signal hesitation — practice your answers to speak more naturally.");
  }

  if (tips.length === 0) {
    tips.push("Great work maintaining eye contact! Keep it up in future interviews.");
  }

  return tips.slice(0, 3);
}

export function GazePresenceCard({
  gazeConsistencyScore,
  gazeDistribution,
  gazeCoverage,
  gazeTimeline,
  isLoading = false,
}: GazePresenceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-6 w-full animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Insufficient data fallback
  if (gazeConsistencyScore === null) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">Eye Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t track your gaze for enough of the session to produce a
            score. Try improving lighting and camera positioning.
          </p>
          {gazeCoverage !== null && gazeCoverage > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Coverage: {Math.round(gazeCoverage * 100)}% of session
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const colors = getGazeScoreColor(gazeConsistencyScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Eye Contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score badge + interpretive copy */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${colors.bg} ${colors.border}`}
          >
            <span className={`text-xl font-bold ${colors.text}`}>
              {Math.round(gazeConsistencyScore)}
            </span>
          </div>
          <div>
            <p className={`font-semibold ${colors.text}`}>{colors.label}</p>
            <p className="text-sm text-muted-foreground">
              {interpretiveCopy(gazeConsistencyScore)}
            </p>
            {gazeCoverage !== null && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Coverage: {Math.round(gazeCoverage * 100)}% of session
              </p>
            )}
          </div>
        </div>

        {/* Timeline strip */}
        {gazeTimeline && gazeTimeline.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Gaze Timeline
            </p>
            <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded">
              {gazeTimeline.map((bucket) => (
                <div
                  key={bucket.bucket_start_s}
                  title={`${bucket.bucket_start_s}s–${bucket.bucket_start_s + 10}s: ${bucket.dominant_zone} (${bucket.center_pct}% camera)`}
                  className={`flex-1 motion-safe:transition-colors ${zoneColor(bucket.dominant_zone)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Camera
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                Up
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                Down
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                Side
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                Off-screen
              </span>
            </div>
          </div>
        )}

        {/* Distribution row */}
        {gazeDistribution && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Gaze Distribution
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                { label: "Camera", value: gazeDistribution.center_pct },
                { label: "Up", value: gazeDistribution.up_pct },
                { label: "Down", value: gazeDistribution.down_pct },
                { label: "Left", value: gazeDistribution.left_pct },
                { label: "Right", value: gazeDistribution.right_pct },
                { label: "Off-screen", value: gazeDistribution.off_screen_pct },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md border p-2 text-center">
                  <p className="text-sm font-semibold">{value}%</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable tips */}
        {gazeDistribution && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Tips to Look More Confident
            </p>
            <ul className="space-y-1">
              {buildTips(gazeDistribution).map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-primary">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
