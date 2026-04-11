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
} from "../../../../tests/setup-db";
import { users, interviewSessions } from "@/lib/schema";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the test database
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

describe("GET /api/sessions/quota (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(interviewSessions);
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

  it("returns full quota for user with no sessions today", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.plan).toBe("free");
    expect(data.planName).toBe("Free");
    expect(data.used).toBe(0);
    expect(data.limit).toBe(3);
    expect(data.remaining).toBe(3);
  });

  it("returns correct used count after creating sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "technical", config: {} },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(data.used).toBe(2);
    expect(data.remaining).toBe(1);
  });

  it("returns 0 remaining when at limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    await db.insert(interviewSessions).values([
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "behavioral", config: {} },
      { userId: TEST_USER.id, type: "behavioral", config: {} },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(data.used).toBe(3);
    expect(data.remaining).toBe(0);
  });
});
