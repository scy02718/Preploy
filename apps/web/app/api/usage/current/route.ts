import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentPeriodUsage } from "@/lib/usage";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { FREE_PLAN_MONTHLY_INTERVIEW_LIMIT } from "@/lib/plans";
import { createRequestLogger } from "@/lib/logger";

/**
 * GET /api/usage/current
 *
 * Returns the authenticated user's current period interview usage and plan.
 * Used by the dashboard usage meter and the upgrade prompt dialog.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "GET /api/usage/current",
    userId: session.user.id,
  });

  const plan = await getCurrentUserPlan(session.user.id);
  const used = plan === "pro" ? 0 : await getCurrentPeriodUsage(session.user.id);
  const limit = plan === "pro" ? null : FREE_PLAN_MONTHLY_INTERVIEW_LIMIT;

  log.info({ plan, used, limit }, "fetched current usage");

  return NextResponse.json({ plan, used, limit });
}
