"use client";

import { useState } from "react";

export interface ChoiceItem {
  line: string;
  feedback: string;
  ideal: boolean;
}

interface ChooseYourLineWidgetProps {
  scenario: string;
  choices: ChoiceItem[];
}

export function ChooseYourLineWidget({
  scenario,
  choices,
}: ChooseYourLineWidgetProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const activeChoice = selected !== null ? choices[selected] : null;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{scenario}</p>
      <p className="text-xs text-muted-foreground">
        Select the response you would give:
      </p>
      <div className="space-y-2">
        {choices.map((choice, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSelected ? null : i)}
              data-testid={`choice-${i}`}
              aria-pressed={isSelected}
              className={[
                "w-full rounded-md border px-4 py-3 text-left text-sm transition-colors",
                isSelected
                  ? choice.ideal
                    ? "border-green-600 bg-green-50/60 dark:bg-green-950/30"
                    : "border-red-500 bg-red-50/60 dark:bg-red-950/30"
                  : "border-muted-foreground/30 bg-background hover:border-primary/50",
              ].join(" ")}
            >
              <span className="font-medium">
                ({String.fromCharCode(65 + i)}){" "}
              </span>
              {choice.line}
            </button>
          );
        })}
      </div>

      {activeChoice && (
        <div
          data-testid="choice-feedback"
          className={[
            "rounded-md border px-4 py-3 text-sm",
            activeChoice.ideal
              ? "border-green-600/40 bg-green-50/40 dark:bg-green-950/20"
              : "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20",
          ].join(" ")}
        >
          <p
            className={[
              "mb-1 text-xs font-semibold uppercase tracking-wide",
              activeChoice.ideal
                ? "text-green-700 dark:text-green-400"
                : "text-amber-700 dark:text-amber-400",
            ].join(" ")}
          >
            {activeChoice.ideal ? "Best response" : "Not the strongest choice"}
          </p>
          <p>{activeChoice.feedback}</p>
        </div>
      )}
    </div>
  );
}
