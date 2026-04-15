import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

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

const mockPortalCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockPortalCreate(...args),
      },
    },
  },
}));

import { POST } from "./route";

const TEST_USER_FREE = {
  id: "00000000-0000-0000-0000-000000000010",
  email: "portal-free@example.com",
  name: "Portal Free User",
};

const TEST_USER_PRO = {
  id: "00000000-0000-0000-0000-000000000011",
  email: "portal-pro@example.com",
  name: "Portal Pro User",
  stripeCustomerId: "cus_portal_pro",
};

function makePostRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/portal", {
    method: "POST",
  });
}

describe("POST /api/billing/portal (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db
      .insert(users)
      .values([TEST_USER_FREE, TEST_USER_PRO])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(null);

    const db = getTestDb();
    // Reset the free user (no customer id) and pro user (has customer id)
    await db
      .update(users)
      .set({ stripeCustomerId: null })
      .where(eq(users.id, TEST_USER_FREE.id));
    await db
      .update(users)
      .set({ stripeCustomerId: "cus_portal_pro" })
      .where(eq(users.id, TEST_USER_PRO.id));

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
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when user is not in the db", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(404);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the user has no stripe_customer_id", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_FREE.id } });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no billing/i);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns 200 with a url for a user with a stripe customer", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_PRO.id } });
    mockPortalCreate.mockResolvedValueOnce({
      id: "bps_test_123",
      url: "https://billing.stripe.com/session/test_123",
    });

    const res = await POST(makePostRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/billing\.stripe\.com/);

    expect(mockPortalCreate).toHaveBeenCalledTimes(1);
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_portal_pro",
      return_url: "http://localhost:3000/profile",
    });
  });

  it("falls back to AUTH_URL when NEXTAUTH_URL is unset", async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.AUTH_URL = "https://preploy.vercel.app";

    mockAuth.mockResolvedValue({ user: { id: TEST_USER_PRO.id } });
    mockPortalCreate.mockResolvedValueOnce({
      id: "bps_test_456",
      url: "https://billing.stripe.com/session/test_456",
    });

    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_portal_pro",
      return_url: "https://preploy.vercel.app/profile",
    });

    process.env.NEXTAUTH_URL = "http://localhost:3000";
    delete process.env.AUTH_URL;
  });

  it("returns 429 when the rate limiter rejects the request", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_PRO.id } });
    mockCheckRateLimit.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await POST(makePostRequest());
    expect(res.status).toBe(429);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });
});
