"use client";

import { Button } from "@/components/ui/button";
import { X, Lightbulb } from "lucide-react";

interface HintPanelProps {
  hints: string[];
  isHintLoading: boolean;
  onClose: () => void;
}

/**
 * Overlay panel listing coaching hints received during a technical session.
 *
 * - Absolutely positioned inside the right (editor) panel — parent must have `relative`.
 * - Empty state: not rendered (caller gates on hints.length + isHintLoading).
 * - Loading skeleton at the end of the list while a hint is in-flight.
 * - Dismiss X button closes the panel without ending the session.
 */
export function HintPanel({ hints, isHintLoading, onClose }: HintPanelProps) {
  // Don't render if there's nothing to show
  if (hints.length === 0 && !isHintLoading) return null;

  return (
    <div
      className="absolute top-0 right-0 z-10 flex h-full w-80 flex-col border-l bg-background shadow-[var(--shadow-lg)]"
      role="complementary"
      aria-label="Coaching hints"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[color:var(--primary)]" aria-hidden="true" />
          <span className="text-sm font-medium">Coaching Hints</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close hint panel"
          className="h-7 w-7"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Hints list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        aria-live="polite"
        aria-atomic="false"
      >
        {hints.map((hint, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Hint {index + 1}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{hint}</p>
          </div>
        ))}

        {/* Loading skeleton for in-flight hint */}
        {isHintLoading && (
          <div className="rounded-lg border bg-card p-3 animate-pulse">
            <div className="mb-1.5 h-3 w-12 rounded bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-[95%] rounded bg-muted" />
              <div className="h-4 w-[80%] rounded bg-muted" />
              <div className="h-4 w-[60%] rounded bg-muted" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
