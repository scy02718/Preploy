import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import type { PlanData, PlanDay } from "@/lib/plan-generator";

const markCompletedSchema = z.object({
  day_index: z.number().int().min(0),
  completed: z.boolean(),
});

// GET /api/plans/[id] — get a specific plan
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [plan] = await db
    .select()
    .from(interviewPlans)
    .where(
      and(
        eq(interviewPlans.id, id),
        eq(interviewPlans.userId, session.user.id)
      )
    );

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

// PATCH /api/plans/[id] — mark a day as completed/uncompleted
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = markCompletedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { day_index, completed } = parsed.data;

  // Fetch the plan first
  const [plan] = await db
    .select()
    .from(interviewPlans)
    .where(
      and(
        eq(interviewPlans.id, id),
        eq(interviewPlans.userId, session.user.id)
      )
    );

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const planData = plan.planData as PlanData;
  if (!planData.days || day_index >= planData.days.length) {
    return NextResponse.json(
      { error: "Invalid day index" },
      { status: 400 }
    );
  }

  // Update the specific day's completed status
  const updatedDays: PlanDay[] = planData.days.map((day, i) =>
    i === day_index ? { ...day, completed } : day
  );

  const [updated] = await db
    .update(interviewPlans)
    .set({ planData: { ...planData, days: updatedDays } })
    .where(
      and(
        eq(interviewPlans.id, id),
        eq(interviewPlans.userId, session.user.id)
      )
    )
    .returning();

  return NextResponse.json(updated);
}
