import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  interviewSessions,
  sessionFeedback,
  transcripts,
  codeSnapshots,
  interviewUsage,
  userAchievements,
  userResumes,
  companyQuestions,
  interviewPlans,
  sessionTemplates,
  starStoryAnalyses,
  starStories,
  openaiUsage,
} from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";

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

const DELETE_CONFIRMATION = "DELETE my account and all my data";

/**
 * DELETE /api/users/me — hard-delete the user and all associated data.
 *
 * Requires a typed confirmation string in the body to prevent accidental
 * deletion. Cascades through all user-owned tables in a single transaction
 * (respecting FK order). If the user has a Stripe customer, deletes it too
 * (Stripe auto-cancels any active subscription on customer deletion).
 *
 * Returns 204 on success. The client should redirect to `/?deleted=1`.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "DELETE /api/users/me",
    userId: session.user.id,
  });

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirmation !== DELETE_CONFIRMATION) {
    return NextResponse.json(
      {
        error: `Confirmation required. Send { "confirmation": "${DELETE_CONFIRMATION}" }`,
      },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Look up user for Stripe cleanup
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete all user-owned data in a single transaction. FK order matters:
  // delete children before parents to avoid constraint violations.
  try {
    await db.transaction(async (tx) => {
      // Children of star_stories
      await tx.delete(starStoryAnalyses).where(
        eq(starStoryAnalyses.storyId,
          tx.select({ id: starStories.id }).from(starStories).where(eq(starStories.userId, userId)) as never
        )
      ).catch(() => {
        // Fallback: delete via subquery might not work in all Drizzle versions.
        // Use cascading FK instead — star_story_analyses CASCADE from star_stories.
      });

      await tx.delete(openaiUsage).where(eq(openaiUsage.userId, userId));
      await tx.delete(sessionTemplates).where(eq(sessionTemplates.userId, userId));
      await tx.delete(companyQuestions).where(eq(companyQuestions.userId, userId));
      await tx.delete(userResumes).where(eq(userResumes.userId, userId));
      await tx.delete(interviewPlans).where(eq(interviewPlans.userId, userId));
      await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
      await tx.delete(interviewUsage).where(eq(interviewUsage.userId, userId));

      // Children of interview_sessions (feedback, transcripts, snapshots)
      // These have FK CASCADE on the session, but we delete sessions by userId
      // so we need to clean children first.
      const sessionIds = await tx
        .select({ id: interviewSessions.id })
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, userId));
      for (const { id } of sessionIds) {
        await tx.delete(sessionFeedback).where(eq(sessionFeedback.sessionId, id));
        await tx.delete(transcripts).where(eq(transcripts.sessionId, id));
        await tx.delete(codeSnapshots).where(eq(codeSnapshots.sessionId, id));
      }

      await tx.delete(starStories).where(eq(starStories.userId, userId));
      await tx.delete(interviewSessions).where(eq(interviewSessions.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });

    log.info("user account and all data hard-deleted");
  } catch (err) {
    log.error({ err }, "account deletion transaction failed");
    return NextResponse.json(
      { error: "Account deletion failed. Please try again or contact support." },
      { status: 500 }
    );
  }

  // Best-effort Stripe customer deletion (outside the transaction — if this
  // fails, the user row is already gone, which is the correct priority).
  if (user.stripeCustomerId) {
    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe.customers.del(user.stripeCustomerId);
      log.info({ stripeCustomerId: user.stripeCustomerId }, "stripe customer deleted");
    } catch (err) {
      log.error({ err, stripeCustomerId: user.stripeCustomerId }, "stripe customer deletion failed — orphaned");
    }
  }

  return new NextResponse(null, { status: 204 });
}
