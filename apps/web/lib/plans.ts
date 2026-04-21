/**
 * Plan configuration — single source of truth for all plan tiers and limits.
 * To add a new plan or change limits, edit this file only.
 *
 * Dollar amounts live here and ONLY here. Do not hard-code prices elsewhere.
 */

// ---- Legacy type (keep for backward compatibility) ----

export type PlanId = "free" | "pro" | "max";

export interface PlanConfig {
  id: PlanId;
  name: string;
  dailySessionLimit: number;
}

// Legacy `dailySessionLimit` values are intentionally high — the primary
// cost gate is now the MONTHLY cap enforced by `tryConsumeInterviewSlot`
// (see `lib/usage.ts`). Daily numbers here only exist as a soft fair-use
// safety net against burst abuse (e.g. 40 sessions in 10 minutes) and the
// dashboard's legacy "Sessions Today" widget.
export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    dailySessionLimit: 3,
  },
  pro: {
    id: "pro",
    name: "Pro",
    dailySessionLimit: 40,
  },
  max: {
    id: "max",
    name: "Max",
    dailySessionLimit: 40,
  },
};

/**
 * Get the plan config for a given plan ID.
 * Falls back to "free" if the plan is unknown.
 */
export function getPlanConfig(planId: string | null | undefined): PlanConfig {
  if (planId && planId in PLANS) {
    return PLANS[planId as PlanId];
  }
  return PLANS.free;
}

// ---- New plan system (story #35) ----

/** Billable plan tiers. "max" is treated as "pro" for billing purposes. */
export type Plan = "free" | "pro";

export interface PlanLimits {
  /** Maximum interviews per calendar month. null = unlimited. */
  monthlyInterviews: number | null;
  /** Maximum daily sessions (for in-app quota checks). */
  dailySessions: number;
  /** Maximum Pro-tier analysis runs per billing period. 0 = not available on this plan. */
  proAnalysisMonthly: number;
}

export interface PlanDefinition {
  id: Plan;
  name: string;
  /** Monthly price in US dollars. 0 = free. */
  priceUsd: number;
  /** Effective monthly price if billed annually. 0 = no annual option. */
  annualMonthlyEquivalentUsd: number;
  /** Total annual price (what the user is charged once per year). */
  annualTotalUsd: number;
  /** Env var that holds the Stripe price ID for the MONTHLY recurring price. */
  stripePriceEnvKey: string;
  /** Env var that holds the Stripe price ID for the ANNUAL recurring price. */
  stripePriceEnvKeyAnnual: string;
  limits: PlanLimits;
}

export const FREE_PLAN_MONTHLY_INTERVIEW_LIMIT = 3;
export const PRO_PLAN_MONTHLY_INTERVIEW_LIMIT = 40;
export const PRO_ANALYSIS_MONTHLY_LIMIT = 10;

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    annualMonthlyEquivalentUsd: 0,
    annualTotalUsd: 0,
    stripePriceEnvKey: "STRIPE_PRICE_FREE",
    stripePriceEnvKeyAnnual: "STRIPE_PRICE_FREE",
    limits: {
      monthlyInterviews: FREE_PLAN_MONTHLY_INTERVIEW_LIMIT,
      dailySessions: 3,
      proAnalysisMonthly: 0,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    // Monthly: $15. Annual: $120/year = $10/month effective (33% discount).
    // Grounded in the cost-per-session analysis — see `dev_logs/pricing-model.md`
    // (forthcoming). The monthly cap of 40 sessions is the hard ceiling;
    // there is no per-day cap besides the fair-use number in `PLANS`.
    priceUsd: 15,
    annualMonthlyEquivalentUsd: 10,
    annualTotalUsd: 120,
    stripePriceEnvKey: "STRIPE_PRO_PRICE_ID",
    stripePriceEnvKeyAnnual: "STRIPE_PRO_PRICE_ID_ANNUAL",
    limits: {
      monthlyInterviews: PRO_PLAN_MONTHLY_INTERVIEW_LIMIT,
      dailySessions: 40,
      proAnalysisMonthly: PRO_ANALYSIS_MONTHLY_LIMIT,
    },
  },
};

/** Maximum wall-clock duration of a single behavioral interview session. */
export const BEHAVIORAL_SESSION_MAX_DURATION_SECONDS = 20 * 60; // 20 minutes

/**
 * Returns the PlanLimits for the given Plan.
 * "max" plan (legacy) is treated as "pro" for limit purposes.
 */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_DEFINITIONS[plan].limits;
}
