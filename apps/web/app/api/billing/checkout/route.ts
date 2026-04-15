import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/api-utils";
import { createRequestLogger } from "@/lib/logger";

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for the Pro plan.
 * Looks up or creates a Stripe customer for the current user, persisting
 * stripe_customer_id on the users row for re-use on subsequent calls.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/billing/checkout",
    userId: session.user.id,
  });

  const rateLimited = checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!proPriceId) {
    log.error("STRIPE_PRO_PRICE_ID is not configured");
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 500 }
    );
  }

  // Load user row to get or create stripe customer
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    log.warn("user not found in db");
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;

  // Create Stripe customer if one doesn't exist yet
  if (!customerId) {
    log.info("creating new stripe customer");
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;

    // Persist so subsequent calls reuse the same customer
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id));

    log.info({ stripeCustomerId: customerId }, "stripe customer created and saved");
  } else {
    log.info({ stripeCustomerId: customerId }, "reusing existing stripe customer");
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: proPriceId, quantity: 1 }],
    success_url: `${baseUrl}/profile?billing=success`,
    cancel_url: `${baseUrl}/profile?billing=cancelled`,
    metadata: { userId: user.id },
  });

  log.info({ checkoutSessionId: checkoutSession.id }, "checkout session created");

  return NextResponse.json({ url: checkoutSession.url });
}
