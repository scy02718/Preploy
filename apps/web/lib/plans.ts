/**
 * Plan configuration — single source of truth for all plan tiers and limits.
 * To add a new plan or change limits, edit this file only.
 */

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
