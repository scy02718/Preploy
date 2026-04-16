import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

// Mock auth — only auth is mocked
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock the rate-limit helper so we can exercise the 429 branch on demand.
// checkRateLimit is now ASYNC (Redis-backed) and returns NextResponse | null.
// Default to null (passthrough) so existing happy-path tests behave normally.
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<(userId: string) => unknown>(() => null),
}));
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    checkRateLimit: (userId: string) => mockCheckRateLimit(userId),
  };
});

// Mock Stripe SDK — tests should not hit the real Stripe API
const mockCustomersCreate = vi.fn();
const mockCustomersList = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
      list: (...args: unknown[]) => mockCustomersList(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
      },
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
    },
  },
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "checkout-test@example.com",
  name: "Checkout Test User",
};

function makePostRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/checkout", {
    method: "POST",
  });
}

describe("POST /api/billing/checkout (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: rate limit allows the request through (sync return).
    mockCheckRateLimit.mockResolvedValue(null);

    // Reset user's stripe customer id between tests
    const db = getTestDb();
    await db
      .update(users)
      .set({ stripeCustomerId: null })
      .where(eq(users.id, TEST_USER.id));

    // Default env
    process.env.STRIPE_PRO_PRICE_ID = "price_test_pro";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when STRIPE_PRO_PRICE_ID is not set", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    delete process.env.STRIPE_PRO_PRICE_ID;
    const res = await POST(makePostRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);
    process.env.STRIPE_PRO_PRICE_ID = "price_test_pro";
  });

  it("creates a new Stripe customer on first call and persists stripe_customer_id", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new123" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    });

    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/checkout\.stripe\.com/);

    // Verify customer was persisted
    const db = getTestDb();
    const [row] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.stripeCustomerId).toBe("cus_new123");

    // customer.create was called once with user data
    expect(mockCustomersCreate).toHaveBeenCalledTimes(1);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: TEST_USER.email,
        metadata: { userId: TEST_USER.id },
      })
    );
  });

  it("reuses existing Stripe customer on second call (does not call create again)", async () => {
    // Pre-set a stripe customer id
    const db = getTestDb();
    await db
      .update(users)
      .set({ stripeCustomerId: "cus_existing456" })
      .where(eq(users.id, TEST_USER.id));

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_def",
      url: "https://checkout.stripe.com/pay/cs_test_def",
    });

    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/checkout\.stripe\.com/);

    // customer.create should NOT have been called
    expect(mockCustomersCreate).not.toHaveBeenCalled();

    // Checkout session should have been created with the existing customer
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing456" })
    );
  });

  it("creates checkout session in subscription mode with correct URLs", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCustomersCreate.mockResolvedValue({ id: "cus_mode_test" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_mode",
      url: "https://checkout.stripe.com/pay/cs_mode",
    });

    await POST(makePostRequest());

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_test_pro", quantity: 1 }],
        success_url: "http://localhost:3000/profile?billing=success",
        cancel_url: "http://localhost:3000/profile?billing=cancelled",
      })
    );
  });

  it("derives success_url from the request origin when NEXTAUTH_URL and AUTH_URL are unset", async () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCustomersCreate.mockResolvedValue({ id: "cus_origin_test" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_origin",
      url: "https://checkout.stripe.com/pay/cs_origin",
    });

    // Simulate a request coming in on the deployed Vercel host.
    const req = new NextRequest(
      "https://preploy.tech/api/billing/checkout",
      { method: "POST" }
    );
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://preploy.tech/profile?billing=success",
        cancel_url: "https://preploy.tech/profile?billing=cancelled",
      })
    );

    // Reset for other tests
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("returns 404 when user is not found in db", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(404);
  });

  it("returns 429 when the rate limiter rejects the request", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await POST(makePostRequest());

    expect(res.status).toBe(429);
    // Stripe should never have been called when rate-limited.
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });
});
