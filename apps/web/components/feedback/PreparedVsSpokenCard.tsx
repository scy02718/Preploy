"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitCompareArrows } from "lucide-react";

export interface DriftAnalysis {
  added: string[];
  omitted: string[];
  tightened: string[];
  loosened: string[];
}

interface SectionProps {
  title: string;
  items: string[];
  emptyLabel: string;
}

function DriftSection({ title, items, emptyLabel }: SectionProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PreparedVsSpokenCardProps {
  driftAnalysis: DriftAnalysis;
}

export function PreparedVsSpokenCard({ driftAnalysis }: PreparedVsSpokenCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompareArrows className="h-4 w-4" />
          Prepared vs. Spoken
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          How your spoken answer evolved from your written STAR story — an opportunity to refine your preparation.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DriftSection
            title="Added"
            items={driftAnalysis.added}
            emptyLabel="Nothing new added — your spoken answer stayed close to your preparation."
          />
          <DriftSection
            title="Omitted"
            items={driftAnalysis.omitted}
            emptyLabel="Nothing key was left out — great coverage of your prepared story."
          />
          <DriftSection
            title="Tightened"
            items={driftAnalysis.tightened}
            emptyLabel="No notable tightening — your level of detail was consistent."
          />
          <DriftSection
            title="Loosened"
            items={driftAnalysis.loosened}
            emptyLabel="No notable loosening — your specificity held up well under pressure."
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton that mirrors the PreparedVsSpokenCard shape.
 * Render this while the feedback data is loading.
 */
export function PreparedVsSpokenCardSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="space-y-1">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
