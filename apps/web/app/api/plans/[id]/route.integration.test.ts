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

// Mock only the rate limiter — `requireProFeature` runs for real against
// the test DB so we exercise the actual gating logic end-to-end.
vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils"
  );
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue(null),
  };
});

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

const STAR_PREP_PLAN_DATA = {
  days: [
    {
      date: "2026-04-12",
      focus: "behavioral",
      day_type: "star-prep",
      topics: ["STAR story drafting", "Leadership narrative"],
      session_type: "behavioral",
      completed: false,
    },
    {
      date: "2026-04-13",
      focus: "technical",
      day_type: "technical",
      topics: ["Arrays", "Dynamic programming"],
      session_type: "technical",
      completed: false,
    },
    {
      date: "2026-04-14",
      focus: "behavioral",
      day_type: "resume",
      topics: ["Resume tailoring", "ATS keywords"],
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

    // Default both seeded users to Pro — PATCH is now Pro-gated. The
    // free-tier gating suite below overrides TEST_USER to "free" to
    // exercise the 402 path.
    await db.update(users).set({ plan: "pro" });

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

  // ---- star-prep day_type round-trip tests ----

  it("GET returns a plan containing a star-prep day (round-trip through DB)", async () => {
    const db = getTestDb();
    // Insert a plan with star-prep day_type
    const [starPlan] = await db
      .insert(interviewPlans)
      .values({
        userId: TEST_USER.id,
        company: "Stripe",
        role: "Engineer",
        interviewDate: new Date("2026-05-01"),
        planData: STAR_PREP_PLAN_DATA,
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(...makeGetRequest(starPlan.id));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.planData.days[0].day_type).toBe("star-prep");
    expect(data.planData.days[1].day_type).toBe("technical");
    expect(data.planData.days[2].day_type).toBe("resume");
  });

  it("PATCH works on a plan with star-prep days — preserves day_type field", async () => {
    const db = getTestDb();
    const [starPlan] = await db
      .insert(interviewPlans)
      .values({
        userId: TEST_USER.id,
        company: "Stripe",
        role: "Engineer",
        interviewDate: new Date("2026-05-01"),
        planData: STAR_PREP_PLAN_DATA,
      })
      .returning();

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      ...makePatchRequest(starPlan.id, { day_index: 0, completed: true })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    // day_type must be preserved after the toggle
    expect(data.planData.days[0].completed).toBe(true);
    expect(data.planData.days[0].day_type).toBe("star-prep");
  });

  it("legacy plans without day_type still round-trip correctly", async () => {
    // SAMPLE_PLAN_DATA has no day_type field (legacy)
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(...makeGetRequest(planId));
    expect(res.status).toBe(200);

    const data = await res.json();
    // Legacy days should not have day_type set
    expect(data.planData.days[0].day_type).toBeUndefined();
    expect(data.planData.days[0].focus).toBe("behavioral");
  });

  // ---- Free-tier gating (Pro-only PATCH) ----
  describe("free-tier gating", () => {
    beforeEach(async () => {
      const db = getTestDb();
      await db
        .update(users)
        .set({ plan: "free" })
        .where(eq(users.id, TEST_USER.id));
    });

    it("PATCH is blocked with 402 for free-tier users (day completion)", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const req = new NextRequest(
        `http://localhost:3000/api/plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_index: 0, completed: true }),
        }
      );
      const res = await PATCH(req, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data).toEqual({
        error: "pro_plan_required",
        feature: "planner",
        currentPlan: "free",
      });
    });

    it("PATCH archive toggle is also blocked with 402 for free-tier", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const req = new NextRequest(
        `http://localhost:3000/api/plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }
      );
      const res = await PATCH(req, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(402);
    });

    it("GET stays open for free-tier (read-only grandfathering)", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const req = new NextRequest(
        `http://localhost:3000/api/plans/${planId}`
      );
      const res = await GET(req, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(planId);
    });

    it("DELETE stays open for free-tier (cleanup grandfathering)", async () => {
      mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

      const req = new NextRequest(
        `http://localhost:3000/api/plans/${planId}`,
        { method: "DELETE" }
      );
      const res = await DELETE(req, {
        params: Promise.resolve({ id: planId }),
      });
      expect(res.status).toBe(204);
    });
  });
});
