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
import { users, sessionTemplates } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { GET, POST } from "./route";

const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com", name: "Test User" };

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/templates");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API /api/templates (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(sessionTemplates);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // --- GET ---
  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("GET returns empty array when no templates", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("GET returns user's templates", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.insert(sessionTemplates).values([
      { userId: TEST_USER.id, name: "Google BQ", type: "behavioral", config: { company_name: "Google" } },
      { userId: TEST_USER.id, name: "LC Medium", type: "technical", config: { difficulty: "medium" } },
    ]);

    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("GET filters by type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    await db.insert(sessionTemplates).values([
      { userId: TEST_USER.id, name: "BQ", type: "behavioral", config: {} },
      { userId: TEST_USER.id, name: "TC", type: "technical", config: {} },
    ]);

    const res = await GET(makeGetRequest({ type: "behavioral" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("behavioral");
  });

  // --- POST ---
  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ name: "Test", type: "behavioral", config: {} }));
    expect(res.status).toBe(401);
  });

  it("POST returns 400 for missing name", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest({ type: "behavioral", config: {} }));
    expect(res.status).toBe(400);
  });

  it("POST returns 400 for invalid type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest({ name: "Test", type: "invalid", config: {} }));
    expect(res.status).toBe(400);
  });

  it("POST creates template and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makePostRequest({
      name: "Google Behavioral",
      type: "behavioral",
      config: { company_name: "Google", interview_style: 0.5, difficulty: 0.7 },
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Google Behavioral");
    expect(data.type).toBe("behavioral");
    expect(data.config.company_name).toBe("Google");
  });
});
