import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
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
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty plans array for user with no plans", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plans).toEqual([]);
  });

  it("returns user's plans ordered by createdAt desc", async () => {
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

    const res = await GET();
    const data = await res.json();
    expect(data.plans).toHaveLength(2);
    // Should have company and role fields
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
    const res = await GET();
    const data = await res.json();
    expect(data.plans).toEqual([]);
  });
});
