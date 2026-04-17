"use client";

import { useEffect, useRef, useState } from "react";

export interface FunnelStage {
  number: number;
  title: string;
  who: string;
  signals: string;
  timeline: string;
  preployFit: string;
}

interface FunnelStepperProps {
  stages: FunnelStage[];
}

function StageCard({
  stage,
  index,
}: {
  stage: FunnelStage;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fallback for environments without IntersectionObserver (e.g. jsdom in tests)
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-testid={`stage-card-${index}`}
      className={[
        "rounded-lg border bg-card p-4 text-sm transition-all",
        visible
          ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 opacity-100"
          : "opacity-0",
      ].join(" ")}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {stage.number}
        </span>
        <h3 className="font-semibold">{stage.title}</h3>
      </div>
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">Who: </dt>
          <dd className="inline">{stage.who}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Tests: </dt>
          <dd className="inline">{stage.signals}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Timeline: </dt>
          <dd className="inline">{stage.timeline}</dd>
        </div>
        <div className="mt-2 rounded-sm bg-primary/5 px-2 py-1">
          <dt className="inline font-medium text-primary">Preploy: </dt>
          <dd className="inline">{stage.preployFit}</dd>
        </div>
      </dl>
    </div>
  );
}

export function FunnelStepper({ stages }: FunnelStepperProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage, i) => (
        <StageCard key={stage.title} stage={stage} index={i} />
      ))}
    </div>
  );
}
