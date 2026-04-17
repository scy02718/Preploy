"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePrefillStore } from "@/stores/prefillStore";
import { useRouter } from "next/navigation";

export interface CompetencyItem {
  competency: string;
  questions: string[];
}

interface CompetencyChipsProps {
  items: CompetencyItem[];
}

export function CompetencyChips({ items }: CompetencyChipsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const setBehavioralPrefill = usePrefillStore(
    (s) => s.setBehavioralPrefill
  );
  const router = useRouter();

  const active = items.find((it) => it.competency === selected) ?? null;

  function handleChipClick(competency: string) {
    setSelected((prev) => (prev === competency ? null : competency));
  }

  function handlePractice(questions: string[]) {
    setBehavioralPrefill({ expected_questions: questions });
    router.push("/interview/behavioral/setup");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {items.map(({ competency }) => (
          <button
            key={competency}
            onClick={() => handleChipClick(competency)}
            data-testid={`chip-${competency}`}
            aria-pressed={selected === competency}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected === competency
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-muted hover:border-primary hover:bg-primary/10",
            ].join(" ")}
          >
            {competency}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="rounded-lg border bg-muted/40 p-4 text-sm"
          data-testid={`panel-${active.competency}`}
        >
          <p className="mb-2 font-semibold">{active.competency} — example questions</p>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-muted-foreground">
            {active.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <Button
            size="sm"
            onClick={() => handlePractice(active.questions)}
            data-testid={`practice-btn-${active.competency}`}
          >
            Practice this
          </Button>
        </div>
      )}
    </div>
  );
}
