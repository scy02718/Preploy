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
    title: "Planner",
    content: "Build a day-by-day prep schedule for a real interview. Unlimited.",
    placement: "right",
  },
  {
    target: 'aside a[href="/resume"]',
    title: "Resume analysis",
    content: "Upload a resume and get likely questions. Unlimited.",
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
