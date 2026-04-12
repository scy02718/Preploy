import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

// GET /api/plans — list user's interview plans
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await db
    .select()
    .from(interviewPlans)
    .where(eq(interviewPlans.userId, session.user.id))
    .orderBy(desc(interviewPlans.createdAt));

  return NextResponse.json({ plans });
}
