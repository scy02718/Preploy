import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { checkRateLimit, requireProFeature } from "@/lib/api-utils";
import { createRequestLogger } from "@/lib/logger";
import type { PlanData, PlanDay } from "@/lib/plan-generator";

const markCompletedSchema = z.object({
  day_index: z.number().int().min(0),
  completed: z.boolean(),
});

// Discriminated union: either day-completion or archive toggle
const patchPlanSchema = z.union([
  markCompletedSchema,
  z.object({ archived: z.boolean() }),
]);

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

// PATCH /api/plans/[id] — mark a day as completed/uncompleted OR archive/unarchive
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitRes = await checkRateLimit(session.user.id);
  if (rateLimitRes) return rateLimitRes;

  // Planner is a Pro feature. Free users keep read-only access to legacy
  // plans via GET, but cannot mark days complete, archive, or unarchive.
  // DELETE remains open (see the DELETE handler) so they can still clean up.
  const gated = await requireProFeature(session.user.id, "planner");
  if (gated) return gated;

  const log = createRequestLogger({ route: "PATCH /api/plans/[id]", userId: session.user.id });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Fetch the plan first (auth guard — 404 for another user's plan)
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

  // Branch: archive toggle
  if ("archived" in parsed.data) {
    const { archived } = parsed.data;
    const archivedAt = archived ? new Date() : null;

    const [updated] = await db
      .update(interviewPlans)
      .set({ archivedAt })
      .where(
        and(
          eq(interviewPlans.id, id),
          eq(interviewPlans.userId, session.user.id)
        )
      )
      .returning();

    log.info({ planId: id, archived }, "Plan archive status updated");
    return NextResponse.json(updated);
  }

  // Branch: day completion toggle
  const { day_index, completed } = parsed.data;
  const planData = plan.planData as PlanData;
  if (!planData.days || day_index >= planData.days.length) {
    return NextResponse.json(
      { error: "Invalid day index" },
      { status: 400 }
    );
  }

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

// DELETE /api/plans/[id] — hard-delete a plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitRes = await checkRateLimit(session.user.id);
  if (rateLimitRes) return rateLimitRes;

  const log = createRequestLogger({ route: "DELETE /api/plans/[id]", userId: session.user.id });

  // Auth guard — 404 for another user's plan (never leak existence)
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

  await db
    .delete(interviewPlans)
    .where(
      and(
        eq(interviewPlans.id, id),
        eq(interviewPlans.userId, session.user.id)
      )
    );

  log.info({ planId: id }, "Plan deleted");
  return new NextResponse(null, { status: 204 });
}
