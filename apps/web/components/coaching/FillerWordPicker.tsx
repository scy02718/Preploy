"use client";

import { useState } from "react";

export interface FillerWord {
  word: string;
  before: string;
  after: string;
  tip: string;
}

interface FillerWordPickerProps {
  fillers: FillerWord[];
}

export function FillerWordPicker({ fillers }: FillerWordPickerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const active = fillers.find((f) => f.word === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {fillers.map(({ word }) => (
          <button
            key={word}
            onClick={() => setSelected((prev) => (prev === word ? null : word))}
            data-testid={`filler-chip-${word}`}
            aria-pressed={selected === word}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected === word
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-muted hover:border-primary hover:bg-primary/10",
            ].join(" ")}
          >
            &ldquo;{word}&rdquo;
          </button>
        ))}
      </div>

      {active && (
        <div
          className="rounded-lg border bg-muted/30 p-4 text-sm"
          data-testid={`filler-panel-${active.word}`}
        >
          <p className="mb-3 font-medium">
            Filler word: <span className="text-primary">&ldquo;{active.word}&rdquo;</span>
          </p>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-red-500/30 bg-red-50/40 p-3 dark:bg-red-950/20">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
                Before
              </p>
              <p className="text-muted-foreground">{active.before}</p>
            </div>
            <div className="rounded-md border border-green-600/30 bg-green-50/40 p-3 dark:bg-green-950/20">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                After
              </p>
              <p className="text-muted-foreground">{active.after}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip: </span>
            {active.tip}
          </p>
        </div>
      )}
    </div>
  );
}
