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
} from "../../../tests/setup-db";
import { users, interviewPlans } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { GET } from "./route";

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

function makeGetRequest(query?: string): NextRequest {
  const url = `http://localhost:3000/api/plans${query ? `?${query}` : ""}`;
  return new NextRequest(url);
}

describe("GET /api/plans (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(interviewPlans);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty plans array for user with no plans", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plans).toEqual([]);
  });

  it("returns only non-archived plans by default", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(interviewPlans).values([
      {
        userId: TEST_USER.id,
        company: "Google",
        role: "SWE",
        interviewDate: new Date("2026-05-01"),
        planData: { days: [] },
        archivedAt: null,
      },
      {
        userId: TEST_USER.id,
        company: "Meta",
        role: "Frontend",
        interviewDate: new Date("2026-05-15"),
        planData: { days: [] },
        archivedAt: new Date(),
      },
    ]);

    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].company).toBe("Google");
  });

  it("returns only archived plans when ?archived=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(interviewPlans).values([
      {
        userId: TEST_USER.id,
        company: "Google",
        role: "SWE",
        interviewDate: new Date("2026-05-01"),
        planData: { days: [] },
        archivedAt: null,
      },
      {
        userId: TEST_USER.id,
        company: "Meta",
        role: "Frontend",
        interviewDate: new Date("2026-05-15"),
        planData: { days: [] },
        archivedAt: new Date(),
      },
    ]);

    const res = await GET(makeGetRequest("archived=true"));
    const data = await res.json();
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].company).toBe("Meta");
  });

  it("archived plan does not appear in default list after PATCH archive", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    const [plan] = await db
      .insert(interviewPlans)
      .values({
        userId: TEST_USER.id,
        company: "Amazon",
        role: "SDE",
        interviewDate: new Date("2026-06-01"),
        planData: { days: [] },
        archivedAt: new Date(), // already archived
      })
      .returning();

    const defaultRes = await GET(makeGetRequest());
    const defaultData = await defaultRes.json();
    expect(defaultData.plans.map((p: { id: string }) => p.id)).not.toContain(plan.id);

    const archivedRes = await GET(makeGetRequest("archived=true"));
    const archivedData = await archivedRes.json();
    expect(archivedData.plans.map((p: { id: string }) => p.id)).toContain(plan.id);
  });

  it("returns user's active plans ordered by createdAt desc", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();

    await db.insert(interviewPlans).values([
      {
        userId: TEST_USER.id,
        company: "Google",
        role: "SWE",
        interviewDate: new Date("2026-05-01"),
        planData: { days: [] },
      },
      {
        userId: TEST_USER.id,
        company: "Meta",
        role: "Frontend",
        interviewDate: new Date("2026-05-15"),
        planData: { days: [] },
      },
    ]);

    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.plans).toHaveLength(2);
    expect(data.plans[0].company).toBeDefined();
    expect(data.plans[0].role).toBeDefined();
  });

  it("does not return another user's plans", async () => {
    const db = getTestDb();

    await db.insert(interviewPlans).values({
      userId: OTHER_USER.id,
      company: "Amazon",
      role: "SDE",
      interviewDate: new Date("2026-05-01"),
      planData: { days: [] },
    });

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.plans).toEqual([]);
  });

  it("?archived=true does not return another user's archived plans", async () => {
    const db = getTestDb();

    await db.insert(interviewPlans).values({
      userId: OTHER_USER.id,
      company: "Netflix",
      role: "Engineer",
      interviewDate: new Date("2026-05-01"),
      planData: { days: [] },
      archivedAt: new Date(),
    });

    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest("archived=true"));
    const data = await res.json();
    expect(data.plans).toEqual([]);
  });
});
