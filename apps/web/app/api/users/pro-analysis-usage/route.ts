import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentUserPlan } from "@/lib/user-plan";
import { getProAnalysisUsage } from "@/lib/usage";
import { createRequestLogger } from "@/lib/logger";

// GET /api/users/pro-analysis-usage — current Pro-analysis quota for the authenticated user
export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "GET /api/users/pro-analysis-usage",
    userId: session.user.id,
  });

  const plan = await getCurrentUserPlan(session.user.id);

  if (plan !== "pro") {
    log.info({ plan }, "free user requested pro-analysis-usage — returning zero shape");
    return NextResponse.json({
      plan: "free",
      used: 0,
      limit: 0,
      periodEnd: null,
    });
  }

  const { used, limit, periodEnd } = await getProAnalysisUsage(session.user.id);

  log.info({ used, limit }, "pro-analysis-usage fetched");

  return NextResponse.json({
    plan: "pro",
    used,
    limit,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
  });
}
