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
} from "../../../../../tests/setup-db";
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

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

describe("POST /api/users/me/disable (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset disabled_at
    const db = getTestDb();
    await db.update(users).set({ disabledAt: null }).where(eq(users.id, TEST_USER.id));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("disables the account and sets disabled_at", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.disabledAt).toBeTruthy();

    // Verify persisted
    const db = getTestDb();
    const [row] = await db.select().from(users).where(eq(users.id, TEST_USER.id));
    expect(row.disabledAt).toBeTruthy();
  });

  it("returns 400 if already disabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, TEST_USER.id));

    const res = await POST();
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already disabled/i);
  });
});
