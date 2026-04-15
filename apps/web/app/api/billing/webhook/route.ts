import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interviewUsage } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { createRequestLogger } from "@/lib/logger";
import type Stripe from "stripe";

/**
 * POST /api/billing/webhook
 * Handles Stripe webhook events for subscription lifecycle management.
 * No auth — verified via Stripe signature instead.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ route: "POST /api/billing/webhook" });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    log.warn("missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log.warn({ err }, "stripe signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  log.info({ eventType: event.type, eventId: event.id }, "processing stripe webhook");

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          log
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          log
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          log
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          log
        );
        break;
      default:
        log.info({ eventType: event.type }, "unhandled event type — skipping");
    }
  } catch (err) {
    // Log and return 200 so Stripe doesn't retry indefinitely.
    // If a user row is missing, that's stale webhook noise, not a bug.
    log.error({ err, eventType: event.type, eventId: event.id }, "webhook handler error");
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Individual event handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed
 * Sets plan to "pro", records subscription ID and period dates.
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  log: ReturnType<typeof createRequestLogger>
) {
  const userId = session.metadata?.userId;
  if (!userId) {
    log.warn({ sessionId: session.id }, "checkout.session.completed: no userId in metadata");
    return;
  }

  if (!session.subscription) {
    log.warn({ sessionId: session.id }, "checkout.session.completed: no subscription on session");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  // Check user exists and guard idempotency BEFORE hitting Stripe API
  const [existing] = await db
    .select({ stripeSubscriptionId: users.stripeSubscriptionId })
    .from(users)
    .where(eq(users.id, userId));

  if (!existing) {
    log.warn({ userId }, "checkout.session.completed: user not found — skipping");
    return;
  }

  // Idempotent: if already set to this subscription, skip
  if (existing.stripeSubscriptionId === subscriptionId) {
    log.info({ userId, subscriptionId }, "checkout.session.completed: already processed — skipping");
    return;
  }

  // Fetch full subscription to get period dates
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  // current_period_start/end moved to subscription.items in Stripe v22+
  const firstItem = subscription.items?.data?.[0];
  const periodStart = firstItem
    ? new Date(firstItem.current_period_start * 1000)
    : new Date();
  const periodEnd = firstItem
    ? new Date(firstItem.current_period_end * 1000)
    : new Date();

  await db
    .update(users)
    .set({
      plan: "pro",
      stripeSubscriptionId: subscriptionId,
      planPeriodStart: periodStart,
      planPeriodEnd: periodEnd,
      pastDueAt: null,
    })
    .where(eq(users.id, userId));

  log.info({ userId, subscriptionId }, "checkout.session.completed: user upgraded to pro");
}

/**
 * customer.subscription.updated
 * Refreshes plan_period_end and plan from subscription status.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  log: ReturnType<typeof createRequestLogger>
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    log.warn({ customerId }, "customer.subscription.updated: no user found — skipping");
    return;
  }

  // current_period_start/end moved to subscription.items in Stripe v22+
  const firstItem = subscription.items?.data?.[0];
  const periodEnd = firstItem
    ? new Date(firstItem.current_period_end * 1000)
    : new Date();
  const periodStart = firstItem
    ? new Date(firstItem.current_period_start * 1000)
    : new Date();

  const status = subscription.status;
  let plan: "free" | "pro" = "free";

  if (status === "active" || status === "trialing") {
    plan = "pro";
  } else if (status === "past_due" || status === "unpaid") {
    // Pro but flagged — we keep plan as pro but the past_due_at will be set
    plan = "pro";
  }
  // "canceled" | "incomplete_expired" | others → "free"

  await db
    .update(users)
    .set({
      plan,
      planPeriodStart: periodStart,
      planPeriodEnd: periodEnd,
      stripeSubscriptionId: subscription.id,
    })
    .where(eq(users.id, user.id));

  log.info({ userId: user.id, status, plan }, "customer.subscription.updated: plan refreshed");
}

/**
 * customer.subscription.deleted
 * Reverts user to free plan, clears subscription ID, resets usage counter.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  log: ReturnType<typeof createRequestLogger>
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    log.warn({ customerId }, "customer.subscription.deleted: no user found — skipping");
    return;
  }

  await db
    .update(users)
    .set({
      plan: "free",
      stripeSubscriptionId: null,
      planPeriodStart: null,
      planPeriodEnd: null,
      pastDueAt: null,
    })
    .where(eq(users.id, user.id));

  // Reset interview_usage for the current period
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  await db
    .delete(interviewUsage)
    .where(eq(interviewUsage.userId, user.id));

  log.info({ userId: user.id }, "customer.subscription.deleted: plan reset to free, usage cleared");
}

/**
 * invoice.payment_failed
 * Sets past_due_at timestamp on the user row.
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  log: ReturnType<typeof createRequestLogger>
) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer as Stripe.Customer | null)?.id;

  if (!customerId) {
    log.warn("invoice.payment_failed: no customer id on invoice — skipping");
    return;
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    log.warn({ customerId }, "invoice.payment_failed: no user found — skipping");
    return;
  }

  await db
    .update(users)
    .set({ pastDueAt: new Date() })
    .where(eq(users.id, user.id));

  log.info({ userId: user.id }, "invoice.payment_failed: past_due_at set");
}
