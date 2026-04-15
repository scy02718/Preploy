import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, interviewUsage } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock the Stripe SDK — we control constructEvent so we can test signed vs unsigned
const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
    },
  },
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "webhook-test@example.com",
  name: "Webhook Test User",
  stripeCustomerId: "cus_webhook_test",
};

function makeWebhookRequest(body: string, sig = "valid-sig"): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

function makeStripeEvent(
  type: string,
  data: Record<string, unknown>
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    type,
    object: "event",
    api_version: "2026-03-25.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

describe("POST /api/billing/webhook (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

    // Reset user state between tests
    const db = getTestDb();
    await db
      .update(users)
      .set({
        plan: "free",
        stripeSubscriptionId: null,
        planPeriodStart: null,
        planPeriodEnd: null,
        pastDueAt: null,
      })
      .where(eq(users.id, TEST_USER.id));

    // Clear usage records
    await db.delete(interviewUsage).where(eq(interviewUsage.userId, TEST_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- Signature verification ----

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification fails (invalid payload)", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeWebhookRequest("{}", "bad-sig"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/signature/i);
  });

  // ---- checkout.session.completed ----

  it("flips plan to pro on checkout.session.completed and stores the period end from items.data[0]", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expectedPeriodEnd = now + 30 * 24 * 3600;
    const event = makeStripeEvent("checkout.session.completed", {
      id: "cs_test_001",
      subscription: "sub_test_001",
      metadata: { userId: TEST_USER.id },
    });

    mockConstructEvent.mockReturnValueOnce(event);
    // Stripe v22 nests period timestamps under subscription.items.data[0].
    mockSubscriptionsRetrieve.mockResolvedValueOnce({
      id: "sub_test_001",
      items: {
        data: [
          {
            current_period_start: now,
            current_period_end: expectedPeriodEnd,
          },
        ],
      },
    });

    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    // Verify DB state
    const db = getTestDb();
    const [row] = await db
      .select({
        plan: users.plan,
        stripeSubscriptionId: users.stripeSubscriptionId,
        planPeriodEnd: users.planPeriodEnd,
      })
      .from(users)
      .where(eq(users.id, TEST_USER.id));

    expect(row.plan).toBe("pro");
    expect(row.stripeSubscriptionId).toBe("sub_test_001");
    // Tight assertion: the period end must come from items.data[0], not fall
    // back to `new Date()`. Allow a few seconds of clock drift.
    expect(row.planPeriodEnd).not.toBeNull();
    const actualSec = Math.floor(row.planPeriodEnd!.getTime() / 1000);
    expect(Math.abs(actualSec - expectedPeriodEnd)).toBeLessThan(5);
  });

  it("is idempotent — same checkout.session.completed event twice makes exactly one state change", async () => {
    const now = Math.floor(Date.now() / 1000);
    const event = makeStripeEvent("checkout.session.completed", {
      id: "cs_test_idem",
      subscription: "sub_test_idem",
      metadata: { userId: TEST_USER.id },
    });

    mockConstructEvent.mockReturnValue(event);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: "sub_test_idem",
      items: {
        data: [
          {
            current_period_start: now,
            current_period_end: now + 30 * 24 * 3600,
          },
        ],
      },
    });

    // Process event twice
    await POST(makeWebhookRequest(JSON.stringify({})));
    await POST(makeWebhookRequest(JSON.stringify({})));

    // Only one call to subscriptions.retrieve (second call is idempotent short-circuit)
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledTimes(1);

    // DB should reflect pro plan still
    const db = getTestDb();
    const [row] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.plan).toBe("pro");
  });

  // ---- customer.subscription.deleted ----

  it("resets plan to free and clears subscription on customer.subscription.deleted", async () => {
    // First upgrade the user
    const db = getTestDb();
    await db
      .update(users)
      .set({ plan: "pro", stripeSubscriptionId: "sub_to_delete" })
      .where(eq(users.id, TEST_USER.id));

    const event = makeStripeEvent("customer.subscription.deleted", {
      id: "sub_to_delete",
      customer: TEST_USER.stripeCustomerId,
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      status: "canceled",
    });

    mockConstructEvent.mockReturnValueOnce(event);

    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);

    const [row] = await db
      .select({
        plan: users.plan,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, TEST_USER.id));

    expect(row.plan).toBe("free");
    expect(row.stripeSubscriptionId).toBeNull();
  });

  it("clears interview_usage on customer.subscription.deleted", async () => {
    const db = getTestDb();
    // Insert a usage record
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    await db.insert(interviewUsage).values({
      userId: TEST_USER.id,
      periodStart,
      count: 5,
    });

    const event = makeStripeEvent("customer.subscription.deleted", {
      id: "sub_usage_clear",
      customer: TEST_USER.stripeCustomerId,
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      status: "canceled",
    });

    mockConstructEvent.mockReturnValueOnce(event);
    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);

    // Usage should be cleared
    const usageRows = await db
      .select()
      .from(interviewUsage)
      .where(eq(interviewUsage.userId, TEST_USER.id));
    expect(usageRows).toHaveLength(0);
  });

  // ---- customer.subscription.updated ----

  it("refreshes plan and period_end on customer.subscription.updated (active → pro)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const newPeriodEnd = now + 60 * 24 * 3600;

    // Stripe v22 nests period timestamps under items.data[0].
    const event = makeStripeEvent("customer.subscription.updated", {
      id: "sub_updated",
      customer: TEST_USER.stripeCustomerId,
      status: "active",
      items: {
        data: [
          {
            current_period_start: now,
            current_period_end: newPeriodEnd,
          },
        ],
      },
    });

    mockConstructEvent.mockReturnValueOnce(event);
    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);

    const db = getTestDb();
    const [row] = await db
      .select({ plan: users.plan, planPeriodEnd: users.planPeriodEnd })
      .from(users)
      .where(eq(users.id, TEST_USER.id));

    expect(row.plan).toBe("pro");
    // Tight assertion: must match items.data[0].current_period_end, not
    // fall back to `new Date()`. Allow a few seconds of clock drift.
    expect(row.planPeriodEnd).not.toBeNull();
    const actualSec = Math.floor(row.planPeriodEnd!.getTime() / 1000);
    expect(Math.abs(actualSec - newPeriodEnd)).toBeLessThan(5);
  });

  it("sets plan to free on customer.subscription.updated with canceled status", async () => {
    const now = Math.floor(Date.now() / 1000);

    const event = makeStripeEvent("customer.subscription.updated", {
      id: "sub_canceled_update",
      customer: TEST_USER.stripeCustomerId,
      status: "canceled",
      items: {
        data: [
          {
            current_period_start: now,
            current_period_end: now + 86400,
          },
        ],
      },
    });

    mockConstructEvent.mockReturnValueOnce(event);
    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);

    const db = getTestDb();
    const [row] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.plan).toBe("free");
  });

  // ---- invoice.payment_failed ----

  it("sets past_due_at on invoice.payment_failed", async () => {
    const event = makeStripeEvent("invoice.payment_failed", {
      id: "in_failed",
      customer: TEST_USER.stripeCustomerId,
      status: "open",
    });

    mockConstructEvent.mockReturnValueOnce(event);
    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);

    const db = getTestDb();
    const [row] = await db
      .select({ pastDueAt: users.pastDueAt })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.pastDueAt).not.toBeNull();
  });

  // ---- Stale webhook noise ----

  it("returns 200 (not error) when user is not found — stale webhook noise", async () => {
    const event = makeStripeEvent("checkout.session.completed", {
      id: "cs_stale",
      subscription: "sub_stale",
      metadata: { userId: "00000000-0000-0000-0000-000000000099" },
    });

    mockConstructEvent.mockReturnValueOnce(event);
    mockSubscriptionsRetrieve.mockResolvedValueOnce({
      id: "sub_stale",
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    });

    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    // Should return 200 — stale noise, not a bug
    expect(res.status).toBe(200);
  });

  // ---- Unhandled event types ----

  it("returns 200 for unhandled event types", async () => {
    const event = makeStripeEvent("payment_intent.created", { id: "pi_test" });
    mockConstructEvent.mockReturnValueOnce(event);
    const res = await POST(makeWebhookRequest(JSON.stringify({})));
    expect(res.status).toBe(200);
  });
});
