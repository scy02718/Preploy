"use client";

import dynamic from "next/dynamic";
import type { Props as JoyrideProps, EventData, Status } from "react-joyride";
import { TOUR_STEPS } from "./tour-steps";

// Dynamic import with ssr:false so Joyride never runs during SSR.
// We import the named export { Joyride } and re-export it as the default
// so next/dynamic (which expects a default export) can wrap it.
const JoyrideDynamic = dynamic(
  () => import("react-joyride").then((mod) => ({ default: mod.Joyride })),
  { ssr: false }
);

// Status string constants from react-joyride
const STATUS_FINISHED: Status = "finished";
const STATUS_SKIPPED: Status = "skipped";

export interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ run, onFinish, onSkip }: OnboardingTourProps) {
  function handleEvent(data: EventData) {
    const { status } = data;

    if (status === STATUS_FINISHED) {
      onFinish();
    } else if (status === STATUS_SKIPPED) {
      onSkip();
    }
  }

  const joyrideProps: JoyrideProps = {
    steps: TOUR_STEPS,
    run,
    continuous: true,
    onEvent: handleEvent,
    options: {
      primaryColor: "hsl(220, 90%, 56%)",
      showProgress: true,
      overlayClickAction: "close",
      // Show skip + back + close + next buttons
      buttons: ["back", "close", "primary", "skip"],
    },
  };

  return <JoyrideDynamic {...joyrideProps} />;
}
