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
import { users, interviewPlans } from "@/lib/schema";
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

// Mock rate limit to always pass in tests
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { GET, PATCH, DELETE } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "other@example.com",
  name: "Other User",
};

const SAMPLE_PLAN_DATA = {
  days: [
    {
      date: "2026-04-12",
      focus: "behavioral",
      topics: ["STAR method", "Leadership questions"],
      session_type: "behavioral",
      completed: false,
    },
    {
      date: "2026-04-13",
      focus: "technical",
      topics: ["Arrays", "Hash maps"],
      session_type: "technical",
      completed: false,
    },
    {
      date: "2026-04-14",
      focus: "behavioral",
      topics: ["Conflict resolution"],
      session_type: "behavioral",
      completed: false,
    },
  ],
};

function makeGetRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/plans/${id}`),
    { params: Promise.resolve({ id }) },
  ];
}

function makePatchRequest(
  id: string,
  body: unknown
): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ];
}

function makeDeleteRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/plans/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) },
  ];
}

describe("API /api/plans/[id] (integration)", () => {
  let planId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-apply rate limit mock after clearAllMocks
    const { checkRateLimit } = await import("@/lib/api-utils");
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const db = getTestDb();
    await db.delete(interviewPlans);

    // Create a test plan
    const [created] = await db
      .insert(interviewPlans)
      .values({
        userId: TEST_USER.id,
        company: "Google",
        role: "Senior SWE",
        interviewDate: new Date("2026-04-20"),
        planData: SAMPLE_PLAN_DATA,
      })
      .returning();
    planId = created.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- GET tests ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(...makeGetRequest(planId));
    expect(res.status).toBe(401);
  });

  it("GET returns 404 for non-existent plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(
      ...makeGetRequest("00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(404);
  });

  it("GET returns 404 when accessing another user's plan (authorization)", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await GET(...makeGetRequest(planId));
    expect(res.status).toBe(404);
  });

  it("GET returns the plan with plan data", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(...makeGetRequest(planId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(planId);
    expect(data.company).toBe("Google");
    expect(data.role).toBe("Senior SWE");
    expect(data.planData.days).toHaveLength(3);
  });

  // ---- PATCH day-completion tests ----

  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: 0, completed: true })
    );
    expect(res.status).toBe(401);
  });

  it("PATCH returns 400 for invalid body", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(planId, { invalid: true })
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 400 for negative day_index", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: -1, completed: true })
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 when accessing another user's plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: 0, completed: true })
    );
    expect(res.status).toBe(404);
  });

  it("PATCH returns 400 for out-of-bounds day_index", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: 99, completed: true })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid day index");
  });

  it("PATCH marks a day as completed", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: 0, completed: true })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.planData.days[0].completed).toBe(true);
    expect(data.planData.days[1].completed).toBe(false);
  });

  it("PATCH marks a day as uncompleted", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // First mark as completed
    await PATCH(
      ...makePatchRequest(planId, { day_index: 1, completed: true })
    );

    // Then unmark
    const res = await PATCH(
      ...makePatchRequest(planId, { day_index: 1, completed: false })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.planData.days[1].completed).toBe(false);
  });

  it("PATCH persists the change (verified by subsequent GET)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    await PATCH(
      ...makePatchRequest(planId, { day_index: 2, completed: true })
    );

    const getRes = await GET(...makeGetRequest(planId));
    const data = await getRes.json();
    expect(data.planData.days[2].completed).toBe(true);
  });

  // ---- PATCH archive tests ----

  it("PATCH archive: returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(...makePatchRequest(planId, { archived: true }));
    expect(res.status).toBe(401);
  });

  it("PATCH archive: returns 404 for another user's plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await PATCH(...makePatchRequest(planId, { archived: true }));
    expect(res.status).toBe(404);
  });

  it("PATCH archive: sets archived_at when archived=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(...makePatchRequest(planId, { archived: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.archivedAt).not.toBeNull();

    // Verify in DB
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(interviewPlans)
      .where(eq(interviewPlans.id, planId));
    expect(row.archivedAt).not.toBeNull();
    expect(row.archivedAt).toBeInstanceOf(Date);
  });

  it("PATCH archive: clears archived_at when archived=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // First archive
    await PATCH(...makePatchRequest(planId, { archived: true }));

    // Then unarchive
    const res = await PATCH(...makePatchRequest(planId, { archived: false }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.archivedAt).toBeNull();

    // Verify in DB
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(interviewPlans)
      .where(eq(interviewPlans.id, planId));
    expect(row.archivedAt).toBeNull();
  });

  // ---- DELETE tests ----

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(...makeDeleteRequest(planId));
    expect(res.status).toBe(401);
  });

  it("DELETE returns 404 for another user's plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await DELETE(...makeDeleteRequest(planId));
    expect(res.status).toBe(404);
  });

  it("DELETE returns 404 for non-existent plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(
      ...makeDeleteRequest("00000000-0000-0000-0000-000000000099")
    );
    expect(res.status).toBe(404);
  });

  it("DELETE returns 204 and hard-deletes the plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(...makeDeleteRequest(planId));
    expect(res.status).toBe(204);

    // Verify row is gone from DB
    const db = getTestDb();
    const rows = await db
      .select()
      .from(interviewPlans)
      .where(eq(interviewPlans.id, planId));
    expect(rows).toHaveLength(0);
  });

  it("DELETE: subsequent GET returns 404 after deletion", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    await DELETE(...makeDeleteRequest(planId));

    const getRes = await GET(...makeGetRequest(planId));
    expect(getRes.status).toBe(404);
  });
});
