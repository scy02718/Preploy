import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/api-utils";
import { createRequestLogger } from "@/lib/logger";

/**
 * POST /api/billing/portal
 * Creates a Stripe Billing Portal session for the current user so they can
 * manage their subscription, payment methods, and invoices on Stripe's
 * hosted UI. Requires the user to already have a stripe_customer_id (i.e.
 * to have completed checkout at least once).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/billing/portal",
    userId: session.user.id,
  });

  const rateLimited = checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const [user] = await db
    .select({
      id: users.id,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    log.warn("user not found in db");
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    log.info("portal requested but user has no stripe customer");
    return NextResponse.json(
      { error: "No billing account on file. Subscribe first." },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/profile`,
  });

  log.info(
    { stripeCustomerId: user.stripeCustomerId, portalSessionId: portalSession.id },
    "billing portal session created"
  );

  return NextResponse.json({ url: portalSession.url });
}
