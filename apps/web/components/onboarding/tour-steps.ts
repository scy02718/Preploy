import type { Step } from "react-joyride";

export const TOUR_STEPS: Step[] = [
  {
    target: '[data-testid="welcome-card"]',
    title: "Welcome to Preploy",
    content: "Here's a 60-second tour of what you can do.",
    placement: "center",
  },
  {
    target: 'aside a[href="/star"]',
    title: "STAR Prep",
    content:
      "Draft and refine behavioral answers with AI feedback. Unlimited — no quota cost.",
    placement: "right",
  },
  {
    target: 'aside a[href="/planner"]',
    title: "Planner (Pro)",
    // Copy reframed when Planner moved behind the Pro tier. The tour is
    // shown to free and Pro users alike; Pro users read "Available on
    // Pro" as a confirmation of what they unlocked, free users read it
    // as an honest preview — never a promise of a feature they can't
    // use. See `dev_logs/pricing-model.md` for the full policy.
    content:
      "Available on Pro: build an AI-generated day-by-day prep schedule from now until your interview date.",
    placement: "right",
  },
  {
    target: 'aside a[href="/resume"]',
    title: "Resume tools (Pro)",
    content:
      "Available on Pro: upload your resume and generate questions drawn from your real experience.",
    placement: "right",
  },
  {
    target: 'aside a[href="/coaching"]',
    title: "Coaching guides",
    content: "Free reading — learn the rubric hiring managers use.",
    placement: "right",
  },
  {
    target: 'aside a[href="/interview/behavioral/setup"]',
    title: "When you're ready, run a mock interview",
    content: "Free plan: 3/month. Pro: 40/month.",
    placement: "right",
  },
] as const;

export const FINAL_STEP_CTA_HREF = "/interview/behavioral/setup";
