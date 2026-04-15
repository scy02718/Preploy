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

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    dailySessionLimit: 3,
  },
  pro: {
    id: "pro",
    name: "Pro",
    dailySessionLimit: 10,
  },
  max: {
    id: "max",
    name: "Max",
    dailySessionLimit: 30,
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
}

export interface PlanDefinition {
  id: Plan;
  name: string;
  /** Monthly price in US dollars. 0 = free. */
  priceUsd: number;
  /** Name of the env var that holds the Stripe price ID for this plan. */
  stripePriceEnvKey: string;
  limits: PlanLimits;
}

export const FREE_PLAN_MONTHLY_INTERVIEW_LIMIT = 3;

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    stripePriceEnvKey: "STRIPE_PRICE_FREE",
    limits: {
      monthlyInterviews: FREE_PLAN_MONTHLY_INTERVIEW_LIMIT,
      dailySessions: 3,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 19,
    stripePriceEnvKey: "STRIPE_PRICE_PRO",
    limits: {
      monthlyInterviews: null,
      dailySessions: 100,
    },
  },
};

/**
 * Returns the PlanLimits for the given Plan.
 * "max" plan (legacy) is treated as "pro" for limit purposes.
 */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_DEFINITIONS[plan].limits;
}
