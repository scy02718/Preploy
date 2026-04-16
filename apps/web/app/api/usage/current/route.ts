import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentPeriodUsage } from "@/lib/usage";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { getPlanLimits } from "@/lib/plans";
import { createRequestLogger } from "@/lib/logger";

/**
 * GET /api/usage/current
 *
 * Returns the authenticated user's current period interview usage and plan.
 * Used by the dashboard usage meter and the upgrade prompt dialog.
 *
 * Now reads limits from `getPlanLimits(plan)` so both Free (3/mo) and
 * Pro (40/mo) show their correct quota in the UI.
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
  const limit = getPlanLimits(plan).monthlyInterviews;
  // Only skip the DB read if the plan is truly unlimited (limit === null).
  // Both Free and Pro now have numeric limits, so both hit this path.
  const used = limit === null ? 0 : await getCurrentPeriodUsage(session.user.id);

  log.info({ plan, used, limit }, "fetched current usage");

  return NextResponse.json({ plan, used, limit });
}
