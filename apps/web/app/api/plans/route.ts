import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans } from "@/lib/schema";
import { desc, eq, isNotNull, isNull, and } from "drizzle-orm";

// GET /api/plans — list user's interview plans
// ?archived=true returns only archived plans; default returns only non-archived
export async function GET(request?: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request?.url ? new URL(request.url) : null;
  const archivedParam = url?.searchParams.get("archived");
  const showArchived = archivedParam === "true";

  const plans = await db
    .select()
    .from(interviewPlans)
    .where(
      and(
        eq(interviewPlans.userId, session.user.id),
        showArchived
          ? isNotNull(interviewPlans.archivedAt)
          : isNull(interviewPlans.archivedAt)
      )
    )
    .orderBy(desc(interviewPlans.createdAt));

  return NextResponse.json({ plans });
}
