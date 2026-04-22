"use client";

import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan } from "@/hooks/usePlan";
import { BEHAVIORAL_PERSONAS } from "@/lib/personas";

interface PersonaPickerProps {
  value: string; // persona id
  onChange: (personaId: string) => void;
}

export function PersonaPicker({ value, onChange }: PersonaPickerProps) {
  const { plan } = usePlan();

  // While plan is unknown, render nothing — avoids a flash where Pro-locked
  // items appear unlocked for free users.
  if (plan === undefined) return null;

  return (
    <div role="group" aria-label="Interviewer persona">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium leading-none">
          Interviewer Persona
        </span>
        {plan === "free" && (
          <span className="flex items-center gap-1 text-xs text-[color:var(--primary)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Pro
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Choose the interviewer style that matches your target company.
      </p>
      <Select
        value={value}
        onValueChange={(id) => {
          // base-ui onValueChange passes string | null. Guard against null
          // (e.g. when the user deselects — not possible here since we always
          // have a value, but the type requires it).
          if (id !== null) onChange(id);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select persona" />
        </SelectTrigger>
        <SelectContent>
          {BEHAVIORAL_PERSONAS.map((persona) => {
            const isLocked = persona.proOnly && plan === "free";
            return (
              <SelectItem
                key={persona.id}
                value={persona.id}
                disabled={isLocked}
                data-pro-locked={isLocked ? "true" : undefined}
                aria-disabled={isLocked ? "true" : undefined}
                className="flex flex-col items-start py-2"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{persona.label}</span>
                  {isLocked && (
                    <Sparkles
                      className="h-3.5 w-3.5 shrink-0 text-[color:var(--primary)]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {persona.description}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
