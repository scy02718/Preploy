import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

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
//
// SECURITY: this endpoint must NEVER accept the `plan` field. Plan changes
// are gated entirely through the Stripe webhook (`POST /api/billing/webhook`)
// which flips `users.plan` to `"pro"` on `checkout.session.completed` and
// back to `"free"` on `customer.subscription.deleted`. Accepting a `plan`
// field here would let any signed-in user upgrade themselves for free —
// this exact bug was reported and fixed in this PR.
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

  // `plan` is intentionally not in the allowlist above. Reject any
  // attempt to send it so a confused client doesn't get a silent 200.
  if ("plan" in body) {
    return NextResponse.json(
      {
        error:
          "Plan changes are managed through Stripe billing. Use /api/billing/checkout to upgrade.",
      },
      { status: 403 }
    );
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
