"use client";

import { Sparkles } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePlan } from "@/hooks/usePlan";

interface ProbeDepthControlProps {
  value: 0 | 1 | 2 | 3;
  onChange: (next: 0 | 1 | 2 | 3) => void;
}

const LEVELS: { value: "1" | "2" | "3"; label: string; sub: string }[] = [
  { value: "1", label: "Gentle", sub: "(up to 1 follow-up)" },
  { value: "2", label: "Standard", sub: "(up to 2)" },
  { value: "3", label: "Intense", sub: "(up to 3)" },
];

export function ProbeDepthControl({ value, onChange }: ProbeDepthControlProps) {
  const { plan } = usePlan();

  // Render nothing while plan is loading (undefined)
  if (plan === undefined) return null;

  // Free users: locked cedar pill
  if (plan === "free") {
    return (
      <a
        href="/pricing#follow_up_probing"
        className="block rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 px-4 py-3 transition-colors hover:bg-[color:var(--primary)]/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 shrink-0 text-[color:var(--primary)]"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">Follow-up pressure</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Available on Pro — probe up to 3 layers deep per question.
        </p>
      </a>
    );
  }

  // Pro users: ToggleGroup with three options.
  // Base UI ToggleGroup uses value as readonly string[] (array, not single string).
  // We enforce single-select by using multiple={false} and extracting the first
  // element from the array in onValueChange.
  const selectedValues: readonly string[] =
    value > 0 ? [String(value)] : ["2"]; // default to "2" (Standard) for display

  return (
    <div
      role="group"
      aria-label="Follow-up pressure"
      className="rounded-lg border border-border px-4 py-3 space-y-3"
    >
      <div>
        <p className="text-sm font-medium">Follow-up pressure</p>
        <p className="text-xs text-muted-foreground">
          How hard should the interviewer push?
        </p>
      </div>
      <ToggleGroup
        value={selectedValues}
        onValueChange={(groupValue: string[]) => {
          // Guard: Base UI fires with [] when deselecting. Keep last selection.
          if (!groupValue || groupValue.length === 0) return;
          // Last pressed item wins (Base UI appends new values to the array)
          const raw = groupValue[groupValue.length - 1];
          const n = parseInt(raw, 10) as 1 | 2 | 3;
          if (n === 1 || n === 2 || n === 3) {
            onChange(n);
          }
        }}
        className="grid grid-cols-3 gap-2"
      >
        {LEVELS.map(({ value: lvVal, label, sub }) => (
          <ToggleGroupItem
            key={lvVal}
            value={lvVal}
            className="flex h-auto flex-col gap-0.5 rounded-md border px-3 py-2 data-[pressed]:border-[color:var(--primary)] data-[pressed]:bg-[color:var(--primary)]/10 data-[pressed]:text-[color:var(--primary)]"
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              {sub}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
