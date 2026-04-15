/**
 * Helper to read a user's current plan from the database.
 * This is the canonical source of truth for plan data — downstream
 * enforcement, billing UI, and limit checks all call this.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import type { Plan } from "@/lib/plans";

/**
 * Returns the current plan for a user.
 * Falls back to "free" if the user does not exist or has no plan set.
 * "max" is coerced to "pro" since Plan only has two tiers.
 */
export async function getCurrentUserPlan(userId: string): Promise<Plan> {
  const result = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) {
    return "free";
  }

  const raw = result[0].plan;
  // "max" is a legacy tier — treat it as "pro" for billing purposes
  if (raw === "max" || raw === "pro") {
    return "pro";
  }
  return "free";
}
