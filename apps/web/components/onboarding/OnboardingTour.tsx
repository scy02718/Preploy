"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
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

// Read one of our CSS custom properties as a concrete color string so we
// can hand it to Joyride (which applies colors as inline styles and needs
// values the browser can parse directly, not `var(--…)` references).
function readToken(name: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || undefined;
}

export interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ run, onFinish, onSkip }: OnboardingTourProps) {
  const { resolvedTheme } = useTheme();
  // Token bag — recomputed whenever the theme switches so Joyride picks up
  // the dark-mode cedar (L=0.68) instead of the light-mode cedar (L=0.48)
  // mid-tour without a remount. useMemo reads directly from the DOM because
  // next-themes has already flipped the `.dark` class on <html> by the time
  // this component re-renders with the new `resolvedTheme`; no effect +
  // setState round-trip needed.
  const tokens = useMemo(() => {
    if (typeof window === "undefined") return {};
    return {
      primary: readToken("--primary"),
      primaryForeground: readToken("--primary-foreground"),
      background: readToken("--background"),
      card: readToken("--card"),
      foreground: readToken("--foreground"),
      mutedForeground: readToken("--muted-foreground"),
      border: readToken("--border"),
      destructive: readToken("--destructive"),
    };
  }, [resolvedTheme]);

  function handleEvent(data: EventData) {
    const { status } = data;

    if (status === STATUS_FINISHED) {
      onFinish();
    } else if (status === STATUS_SKIPPED) {
      onSkip();
    }
  }

  // Shared button style — matches the shadcn button proportions the rest
  // of the app uses (44px tall touch target, 0.375rem radius, medium weight).
  const sharedButton = useMemo(
    () => ({
      borderRadius: "0.5rem",
      fontFamily: "var(--font-sans)",
      fontSize: "0.875rem",
      fontWeight: 500,
      padding: "0.5rem 0.875rem",
      lineHeight: 1,
      letterSpacing: "-0.005em",
    }),
    []
  );

  const joyrideProps: JoyrideProps = {
    steps: TOUR_STEPS,
    run,
    continuous: true,
    onEvent: handleEvent,
    options: {
      primaryColor: tokens.primary ?? "hsl(220, 90%, 56%)",
      backgroundColor: tokens.card,
      textColor: tokens.foreground,
      // Warm-tinted overlay (not pure black) so the tour feels like it
      // belongs to the same visual system as the rest of the app.
      overlayColor:
        resolvedTheme === "dark"
          ? "oklch(0.08 0.015 260 / 0.55)"
          : "oklch(0.22 0.018 250 / 0.35)",
      arrowColor: tokens.card,
      spotlightPadding: 6,
      showProgress: true,
      overlayClickAction: "close",
      // Show skip + back + close + next buttons
      buttons: ["back", "close", "primary", "skip"],
    },
    styles: {
      // Outer tooltip — editorial card treatment with our shadow scale.
      tooltip: {
        borderRadius: "0.75rem",
        padding: "1.25rem 1.25rem 1rem",
        backgroundColor: tokens.card,
        color: tokens.foreground,
        border: tokens.border
          ? `1px solid ${tokens.border}`
          : undefined,
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-sans)",
        fontSize: "0.9375rem",
        lineHeight: 1.55,
      },
      tooltipContainer: {
        textAlign: "left",
      },
      // Titles get the display serif — the one editorial moment per step.
      tooltipTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "1.125rem",
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: "-0.015em",
        color: tokens.foreground,
        marginBottom: "0.375rem",
      },
      tooltipContent: {
        padding: 0,
        color: tokens.mutedForeground,
        fontSize: "0.9375rem",
        lineHeight: 1.55,
      },
      tooltipFooter: {
        marginTop: "1.25rem",
        gap: "0.5rem",
      },
      // Primary action — cedar button matching the rest of the app.
      buttonPrimary: {
        ...sharedButton,
        backgroundColor: tokens.primary,
        color: tokens.primaryForeground,
      },
      buttonBack: {
        ...sharedButton,
        backgroundColor: "transparent",
        color: tokens.mutedForeground,
        marginRight: "auto",
      },
      buttonSkip: {
        ...sharedButton,
        backgroundColor: "transparent",
        color: tokens.mutedForeground,
      },
      buttonClose: {
        color: tokens.mutedForeground,
        height: 14,
        width: 14,
        top: 14,
        right: 14,
      },
    },
  };

  return <JoyrideDynamic {...joyrideProps} />;
}
