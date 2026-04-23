/**
 * Feature matrix — maps a `Plan` tier to the set of gated features it unlocks.
 *
 * The matrix lives alongside `lib/plans.ts` (pricing + quota) rather than on
 * `PlanDefinition` itself because a feature is a per-capability boolean, not
 * a tier property. Routes and UI call `hasFeature(plan, feature)` rather than
 * branching on `plan === "pro"` directly — that way adding a new tier or
 * moving a feature between tiers is a one-line change here, not a ripple
 * across every caller.
 *
 * Full rationale (why Planner + Resume are Pro-only, grandfathering policy,
 * what this does NOT gate) lives in `dev_logs/pricing-model.md`.
 */

import type { Plan } from "./plans";

/**
 * Every feature key that can be gated.
 *
 * New features added here MUST also appear in `FEATURE_MATRIX` below — the
 * `Record<FeatureKey, ...>` type will fail compilation if you forget.
 */
export type FeatureKey =
  /** Day-by-day interview prep planner (/planner). */
  | "planner"
  /** Resume upload + resume-tailored question generation (/resume, and the
   *  resume-selector dropdowns in the behavioral + technical setup pages). */
  | "resume"
  /** Interviewer follow-up pressure — probes up to 3 layers deep per question.
   *  See #178. */
  | "follow_up_probing"
  /** Behavioral interviewer personas — Amazon LP, Google STAR, hostile panel,
   *  warm peer, or the default Alex. See #179. */
  | "interviewer_personas"
  /** Custom topic practice — free-text directive that steers the interviewer
   *  toward a specific topic or competency in behavioral + technical sessions.
   *  See #183. */
  | "custom_topic";

/**
 * Which plan tiers grant access to each feature. A feature is unlocked iff
 * the user's current plan appears in the array.
 */
export const FEATURE_MATRIX: Record<FeatureKey, readonly Plan[]> = {
  planner: ["pro"],
  resume: ["pro"],
  follow_up_probing: ["pro"],
  interviewer_personas: ["pro"],
  custom_topic: ["pro"],
};

/**
 * True iff the given plan unlocks the given feature.
 *
 * Use this in server components, API routes, and client components instead
 * of comparing `plan === "pro"` directly — keeps the gating policy in one
 * place and makes it trivial to add a new paid tier (Team, Lifetime, etc.)
 * later without rewriting every branch.
 */
export function hasFeature(plan: Plan, feature: FeatureKey): boolean {
  return FEATURE_MATRIX[feature].includes(plan);
}

/**
 * Display metadata for a gated feature — shown on the paywall page, in
 * marketing copy, and inside the upgrade dialog. Kept alongside the matrix
 * so the "why should I pay" story stays in sync with the gating decision.
 */
export const FEATURE_META: Record<
  FeatureKey,
  {
    label: string;
    href: string;
    /** One-sentence hook that sells the feature to a free user. */
    tagline: string;
    /** 2–3 bullet benefits for the paywall page. */
    benefits: readonly string[];
  }
> = {
  planner: {
    label: "Interview Prep Planner",
    href: "/planner",
    tagline:
      "Generate a day-by-day prep schedule tailored to your interview date and target role.",
    benefits: [
      "AI-generated daily plan from now until your interview",
      "Balanced mix of behavioral + technical + STAR + resume days",
      "Click straight into the right practice flow for every day",
    ],
  },
  resume: {
    label: "Resume Tools",
    href: "/resume",
    tagline:
      "Upload your resume once and get likely questions drawn from your actual experience.",
    benefits: [
      "PDF + plain-text resume ingestion",
      "Company-specific questions referencing your real projects",
      "Attach the resume to any behavioral or technical session setup",
    ],
  },
  follow_up_probing: {
    label: "Follow-up pressure",
    href: "/pricing#follow_up_probing",
    tagline:
      "Get an interviewer that probes up to three layers deep — impact, reasoning, counterfactual — just like a real panel.",
    benefits: [
      "Interviewer asks follow-ups per question before moving on",
      "Gentle / Standard / Intense — pick how hard you want to be pushed",
      "Trains you to go past surface-level STAR answers",
    ],
  },
  interviewer_personas: {
    label: "Interviewer Personas",
    href: "/pricing#interviewer_personas",
    tagline:
      "Practice against Amazon LP, Google STAR, hostile panels, warm peers — pick the interviewer style that matches your target.",
    benefits: [
      "Five behavioral interviewer personas to pick from",
      "Amazon Leadership Principles, Google STAR discipline, hostile panel, warm peer, or the default friendly Alex",
      "Matches the interviewer texture to the companies you're targeting",
    ],
  },
  custom_topic: {
    label: "Custom Topic Practice",
    href: "/pricing#custom_topic",
    tagline:
      "Narrow the interviewer to a specific topic or competency — leadership, conflict resolution, system design, anything you need to drill.",
    benefits: [
      "Free-text directive steers every question toward your chosen topic",
      "Works for both behavioral and technical sessions",
      "Isolate weak areas and build depth where it counts",
    ],
  },
};
