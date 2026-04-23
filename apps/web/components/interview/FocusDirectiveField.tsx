"use client";

import { Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { usePlan } from "@/hooks/usePlan";

interface FocusDirectiveFieldProps {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Pro-only custom topic directive field (#183).
 *
 * - plan === undefined  → renders nothing (plan still loading, mirror ProbeDepthControl)
 * - plan === "free"     → cedar link pill to /pricing#custom_topic
 * - plan === "pro"      → enabled textarea with 500-char counter
 */
export function FocusDirectiveField({ value, onChange }: FocusDirectiveFieldProps) {
  const { plan } = usePlan();

  // Render nothing while plan is loading
  if (plan === undefined) return null;

  // Free users: locked cedar link pill (mirror ProbeDepthControl free-tier branch)
  if (plan === "free") {
    return (
      <a
        href="/pricing#custom_topic"
        className="block rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 px-4 py-3 transition-colors hover:bg-[color:var(--primary)]/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 shrink-0 text-[color:var(--primary)]"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">Focus this session on</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Available on Pro — narrow the interviewer to a specific topic or competency.
        </p>
      </a>
    );
  }

  // Pro users: bordered card with textarea + counter
  return (
    <div className="rounded-lg border border-border px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles
          className="h-4 w-4 shrink-0 text-[color:var(--primary)]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Focus this session on (optional)</p>
      </div>
      <Textarea
        placeholder="e.g. leadership + conflict resolution"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        rows={3}
        aria-label="Focus directive"
      />
      <p className="text-xs text-muted-foreground text-right">
        {value.length}/500
      </p>
    </div>
  );
}
