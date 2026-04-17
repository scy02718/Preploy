"use client";

import dynamic from "next/dynamic";
import type { CallBackProps, Status } from "react-joyride";
import { TOUR_STEPS } from "./tour-steps";

// Dynamic import with ssr:false so Joyride never runs during SSR
const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

// Status string constants from react-joyride
const STATUS_FINISHED = "finished";
const STATUS_SKIPPED = "skipped";

export interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ run, onFinish, onSkip }: OnboardingTourProps) {
  function handleCallback(data: CallBackProps) {
    const { status } = data;
    const typedStatus = status as Status;

    if (typedStatus === STATUS_FINISHED) {
      onFinish();
    } else if (typedStatus === STATUS_SKIPPED) {
      onSkip();
    }
  }

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose={false}
      spotlightClicks={false}
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "hsl(220, 90%, 56%)",
        },
      }}
    />
  );
}
