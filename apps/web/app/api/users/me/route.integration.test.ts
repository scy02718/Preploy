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
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET, PATCH } from "./route";

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
});
