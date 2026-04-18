import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { hasFeature } from "@/lib/features";
import { FeaturePaywall } from "@/components/billing/FeaturePaywall";
import PlannerClient from "./PlannerClient";

/**
 * Planner is a Pro-only feature. Server-component shell so the paywall
 * renders on the initial response — no flash of the full editor UI for
 * free users, and the middleware-or-API check isn't the only gate.
 *
 * Three branches:
 * - Pro → render the interactive `PlannerClient` as before.
 * - Free with existing data → render `PlannerClient` in read-only mode
 *   (grandfather policy; see `dev_logs/pricing-model.md`).
 * - Free with no data → render the `FeaturePaywall`.
 */
export default async function PlannerPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/planner");
  }

  const plan = await getCurrentUserPlan(session.user.id);
  if (hasFeature(plan, "planner")) {
    return <PlannerClient />;
  }

  // Free-tier path: if they have legacy plans, render the grandfathered
  // read-only surface; otherwise show the full paywall page.
  const existing = await db
    .select({ id: interviewPlans.id })
    .from(interviewPlans)
    .where(eq(interviewPlans.userId, session.user.id))
    .limit(1);

  if (existing.length > 0) {
    return <PlannerClient isReadOnly />;
  }

  return <FeaturePaywall feature="planner" />;
}
