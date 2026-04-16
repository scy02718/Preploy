import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/api-utils";
import { createRequestLogger } from "@/lib/logger";

/**
 * Resolve the public base URL the deployed app is running at, in priority
 * order: NEXTAUTH_URL → AUTH_URL → the actual request's origin → localhost.
 *
 * Stripe's success_url and cancel_url are HARD failures if they point at a
 * host the user can't reach (e.g. `localhost:3000` from a Vercel deployment),
 * so the most defensive fallback is the request's own origin — that is by
 * definition reachable by the caller, regardless of how Vercel/Turbo handed
 * env vars to the function.
 */
function resolveBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    new URL(request.url).origin ??
    "http://localhost:3000"
  );
}

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the Pro plan. The caller may
 * optionally pass `{ "interval": "month" | "year" }` in the request body
 * to select the monthly ($15/mo) or annual ($120/year, = $10/mo effective)
 * price. Defaults to "month" if missing or invalid.
 *
 * Looks up or creates a Stripe customer for the current user, persisting
 * `stripe_customer_id` on the users row for reuse on subsequent calls.
 */
export async function POST(request: NextRequest) {
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

  // Parse the optional interval from the body. Tolerate missing/empty bodies
  // since older callers POSTed with no body at all.
  let interval: "month" | "year" = "month";
  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.interval === "year") interval = "year";
  } catch {
    // Empty body is fine — default to monthly.
  }

  const monthlyPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const annualPriceId = process.env.STRIPE_PRO_PRICE_ID_ANNUAL;
  const priceId = interval === "year" ? annualPriceId : monthlyPriceId;

  if (!priceId) {
    log.error(
      { interval, hasMonthly: !!monthlyPriceId, hasAnnual: !!annualPriceId },
      "Stripe price ID not configured for requested interval"
    );
    return NextResponse.json(
      {
        error:
          interval === "year"
            ? "Annual billing is not configured. Try the monthly option."
            : "Billing is not configured",
      },
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

  const baseUrl = resolveBaseUrl(request);
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/profile?billing=success`,
    cancel_url: `${baseUrl}/profile?billing=cancelled`,
    metadata: { userId: user.id, interval },
  });

  log.info(
    { checkoutSessionId: checkoutSession.id, interval },
    "checkout session created"
  );

  return NextResponse.json({ url: checkoutSession.url });
}
