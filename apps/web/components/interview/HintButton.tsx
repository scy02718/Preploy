"use client";

import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/plans";

interface HintButtonProps {
  hintsUsed: number;
  hintsLimit: number;
  isLoading: boolean;
  onClick: () => void;
  plan: Plan | undefined;
}

/**
 * Coaching hint request button.
 *
 * - Shows remaining count in the label.
 * - Disabled when quota is exhausted or while a hint is loading.
 * - Cedar Sparkles icon for Pro users with hints remaining (matches ProAnalysisToggle convention).
 * - Free + exhausted: inline upgrade nudge linking to /pricing.
 */
export function HintButton({
  hintsUsed,
  hintsLimit,
  isLoading,
  onClick,
  plan,
}: HintButtonProps) {
  const hintsRemaining = Math.max(0, hintsLimit - hintsUsed);
  const isExhausted = hintsRemaining <= 0;
  const isDisabled = isExhausted || isLoading;
  const isProWithHints = plan === "pro" && !isExhausted;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={isDisabled}
        aria-label="Request coaching hint"
        aria-disabled={isDisabled}
      >
        {isLoading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : isProWithHints ? (
          <Sparkles
            className="mr-1.5 h-3.5 w-3.5 text-[color:var(--primary)]"
            aria-hidden="true"
          />
        ) : null}
        {isLoading ? "Getting hint…" : `Hint (${hintsRemaining} left)`}
      </Button>

      {/* Upgrade nudge for free users who have exhausted their hint quota */}
      {isExhausted && plan !== "pro" && (
        <Link
          href="/pricing"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline motion-safe:transition-colors"
        >
          Upgrade for {2} more hints
        </Link>
      )}
    </div>
  );
}
