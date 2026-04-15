import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

const VALID_PLANS = new Set(Object.keys(PLANS));

// GET /api/users/me — get current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      plan: users.plan,
      stripeCustomerId: users.stripeCustomerId,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/users/me — update current user profile
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Name update
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length === 0 || name.length > 200) {
      return NextResponse.json(
        { error: "Name must be between 1 and 200 characters" },
        { status: 400 }
      );
    }
    updates.name = name;
  }

  // Image URL update
  if (typeof body.image === "string") {
    updates.image = body.image.trim() || null;
  }

  // Plan update
  if (typeof body.plan === "string") {
    if (!VALID_PLANS.has(body.plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${[...VALID_PLANS].join(", ")}` },
        { status: 400 }
      );
    }
    updates.plan = body.plan as PlanId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.user.id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      plan: users.plan,
      disabledAt: users.disabledAt,
    });

  return NextResponse.json(updated);
}
