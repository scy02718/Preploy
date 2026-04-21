import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, interviewUsage, deletedUsage } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { hashEmailMonth, currentMonth, currentFreePeriodStart } from "@/lib/usage";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, PATCH, DELETE } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API /api/users/me (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- GET ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns user profile", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("test@example.com");
    expect(data.name).toBe("Test User");
    expect(data.plan).toBe("free");
  });

  it("GET returns plan === \"pro\" when the user row is pro", async () => {
    const db = getTestDb();
    // Set plan to "pro" for this test
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, TEST_USER.id));

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBe("pro");

    // Reset to "free" for other tests
    await db.update(users).set({ plan: "free" }).where(eq(users.id, TEST_USER.id));
  });

  it("GET returns gazeTrackingEnabled field", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.gazeTrackingEnabled).toBe("boolean");
    expect(data.gazeTrackingEnabled).toBe(false);
  });

  // ---- PATCH ----

  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("PATCH updates name", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ name: "Updated Name" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Name");

    // Verify persisted
    const db = getTestDb();
    const [row] = await db.select().from(users).where(eq(users.id, TEST_USER.id));
    expect(row.name).toBe("Updated Name");

    // Reset for other tests
    await db.update(users).set({ name: "Test User" }).where(eq(users.id, TEST_USER.id));
  });

  it("PATCH rejects empty name", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ name: "  " }));
    expect(res.status).toBe(400);
  });

  it("PATCH rejects any attempt to change plan (security: must go through Stripe)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ plan: "pro" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Stripe billing/i);

    // Verify the DB row is still on the original plan (no silent write)
    const db = getTestDb();
    const [row] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.plan).toBe("free");
  });

  it("PATCH rejects plan even when paired with a valid name update", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      makePatchRequest({ name: "Hacked", plan: "pro" })
    );
    expect(res.status).toBe(403);

    // Name should NOT have been written either — the request was rejected wholesale
    const db = getTestDb();
    const [row] = await db
      .select({ name: users.name, plan: users.plan })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.name).toBe("Test User");
    expect(row.plan).toBe("free");
  });

  it("PATCH rejects empty body", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
  });

  it("PATCH updates gaze_tracking_enabled to true and persists", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ gaze_tracking_enabled: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gazeTrackingEnabled).toBe(true);

    const db = getTestDb();
    const [row] = await db
      .select({ gazeTrackingEnabled: users.gazeTrackingEnabled })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.gazeTrackingEnabled).toBe(true);

    // Reset
    await db
      .update(users)
      .set({ gazeTrackingEnabled: false })
      .where(eq(users.id, TEST_USER.id));
  });

  it("PATCH updates gaze_tracking_enabled to false and persists", async () => {
    const db = getTestDb();
    // Set to true first
    await db
      .update(users)
      .set({ gazeTrackingEnabled: true })
      .where(eq(users.id, TEST_USER.id));

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ gaze_tracking_enabled: false }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gazeTrackingEnabled).toBe(false);

    const [row] = await db
      .select({ gazeTrackingEnabled: users.gazeTrackingEnabled })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.gazeTrackingEnabled).toBe(false);
  });

  it("PATCH rejects non-boolean gaze_tracking_enabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ gaze_tracking_enabled: "yes" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/boolean/i);
  });

  // ---- DELETE + anti-abuse carry-forward ----

  const DELETE_USER = {
    id: "00000000-0000-0000-0000-000000000099",
    email: "delete-test@example.com",
    name: "Delete User",
  };

  function makeDeleteRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/users/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("DELETE writes a deleted_usage row with correct hash and count (S2)", async () => {
    const db = getTestDb();
    // Seed user + usage
    await db.insert(users).values(DELETE_USER).onConflictDoNothing();
    const periodStart = currentFreePeriodStart();
    await db
      .insert(interviewUsage)
      .values({ userId: DELETE_USER.id, periodStart, count: 2 })
      .onConflictDoNothing();

    mockAuth.mockResolvedValue({ user: { id: DELETE_USER.id } });
    const res = await DELETE(
      makeDeleteRequest({ confirmation: "DELETE my account and all my data" })
    );
    expect(res.status).toBe(204);

    // Verify deleted_usage row exists with correct hash
    const month = currentMonth();
    const expectedHash = hashEmailMonth(DELETE_USER.email, month);
    const [row] = await db
      .select()
      .from(deletedUsage)
      .where(
        and(
          eq(deletedUsage.emailHash, expectedHash),
          eq(deletedUsage.month, month)
        )
      );
    expect(row).toBeDefined();
    expect(row.usageCount).toBe(2);

    // Clean up
    await db
      .delete(deletedUsage)
      .where(eq(deletedUsage.emailHash, expectedHash));
  });

  it("DELETE with zero usage does not write a deleted_usage row", async () => {
    const db = getTestDb();
    const noUsageUser = {
      id: "00000000-0000-0000-0000-000000000098",
      email: "no-usage@example.com",
      name: "No Usage",
    };
    await db.insert(users).values(noUsageUser).onConflictDoNothing();

    mockAuth.mockResolvedValue({ user: { id: noUsageUser.id } });
    const res = await DELETE(
      makeDeleteRequest({ confirmation: "DELETE my account and all my data" })
    );
    expect(res.status).toBe(204);

    const month = currentMonth();
    const hash = hashEmailMonth(noUsageUser.email, month);
    const [row] = await db
      .select()
      .from(deletedUsage)
      .where(
        and(eq(deletedUsage.emailHash, hash), eq(deletedUsage.month, month))
      );
    expect(row).toBeUndefined();
  });

  // ---- Tour timestamp fields (118-I, 118-J) ----

  it("118-I: GET returns tourCompletedAt: null and tourSkippedAt: null for a fresh user", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("tourCompletedAt");
    expect(data).toHaveProperty("tourSkippedAt");
    expect(data.tourCompletedAt).toBeNull();
    expect(data.tourSkippedAt).toBeNull();
  });

  it("118-I: PATCH with tour_completed_at persists and GET reflects it", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const patchRes = await PATCH(
      makePatchRequest({ tour_completed_at: "2026-01-01T00:00:00Z" })
    );
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.tourCompletedAt).toBeTruthy();

    // Verify persisted
    const db = getTestDb();
    const [row] = await db
      .select({ tourCompletedAt: users.tourCompletedAt })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.tourCompletedAt).not.toBeNull();

    // GET also reflects it
    const getRes = await GET();
    const getData = await getRes.json();
    expect(getData.tourCompletedAt).toBeTruthy();

    // Reset
    await db
      .update(users)
      .set({ tourCompletedAt: null })
      .where(eq(users.id, TEST_USER.id));
  });

  it("118-I: PATCH with tour_skipped_at persists", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const patchRes = await PATCH(
      makePatchRequest({ tour_skipped_at: "2026-06-15T12:00:00Z" })
    );
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.tourSkippedAt).toBeTruthy();

    const db = getTestDb();
    const [row] = await db
      .select({ tourSkippedAt: users.tourSkippedAt })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.tourSkippedAt).not.toBeNull();

    // Reset
    await db
      .update(users)
      .set({ tourSkippedAt: null })
      .where(eq(users.id, TEST_USER.id));
  });

  it("118-I: PATCH with tour_completed_at: null resets the column (re-trigger path)", async () => {
    const db = getTestDb();
    // Seed a completed timestamp
    await db
      .update(users)
      .set({ tourCompletedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(users.id, TEST_USER.id));

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makePatchRequest({ tour_completed_at: null }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tourCompletedAt).toBeNull();

    const [row] = await db
      .select({ tourCompletedAt: users.tourCompletedAt })
      .from(users)
      .where(eq(users.id, TEST_USER.id));
    expect(row.tourCompletedAt).toBeNull();
  });

  it("118-J: PATCH with tour_completed_at: 'not-a-date' returns 400", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      makePatchRequest({ tour_completed_at: "not-a-date" })
    );
    expect(res.status).toBe(400);
  });
});
