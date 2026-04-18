"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { usePrefillStore } from "@/stores/prefillStore";
import { resolveDayType } from "@/lib/plan-generator";
import type { PlanDay, PlanDayType } from "@/lib/plan-generator";

export const DAY_TYPE_CONFIG: Record<
  PlanDayType,
  { label: string; href: string; description: string }
> = {
  behavioral: {
    label: "Practice Behavioral",
    href: "/interview/behavioral/setup",
    description: "Mock behavioral interview",
  },
  technical: {
    label: "Practice Technical",
    href: "/interview/technical/setup",
    description: "Mock technical interview",
  },
  "star-prep": {
    label: "Go to STAR Prep",
    href: "/star",
    description: "Write and refine STAR stories",
  },
  resume: {
    label: "Review Resume",
    href: "/resume",
    description: "Review and improve your resume",
  },
  coaching: {
    label: "Go to Coaching",
    href: "/coaching",
    description: "Job search strategy and guidance",
  },
};

interface DayActionButtonProps {
  day: PlanDay;
}

export function DayActionButton({ day }: DayActionButtonProps) {
  const router = useRouter();
  const setStarPrepPrefill = usePrefillStore((s) => s.setStarPrepPrefill);
  const setBehavioralPrefill = usePrefillStore((s) => s.setBehavioralPrefill);
  const setTechnicalPrefill = usePrefillStore((s) => s.setTechnicalPrefill);

  const dayType = resolveDayType(day);
  const config = DAY_TYPE_CONFIG[dayType];

  function handleClick() {
    // Populate the relevant prefill store before navigating so the destination
    // page can pick up the context from this day's topics.
    if (dayType === "star-prep") {
      setStarPrepPrefill({ focus_topics: day.topics });
    } else if (dayType === "behavioral") {
      setBehavioralPrefill({});
    } else if (dayType === "technical") {
      setTechnicalPrefill({});
    }

    router.push(config.href);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      className="shrink-0 gap-1"
      aria-label={config.description}
    >
      {config.label}
      <ArrowRight className="h-3 w-3" />
    </Button>
  );
}
