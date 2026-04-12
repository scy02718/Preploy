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
import { users, sessionTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { GET, PATCH, DELETE } from "./route";

const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com", name: "Test User" };
const OTHER_USER = { id: "00000000-0000-0000-0000-000000000002", email: "other@example.com", name: "Other" };

let testTemplateId: string;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id: string, method = "GET", body?: unknown): NextRequest {
  if (body) {
    return new NextRequest(`http://localhost:3000/api/templates/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new NextRequest(`http://localhost:3000/api/templates/${id}`, { method });
}

describe("API /api/templates/[id] (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getTestDb();
    await db.delete(sessionTemplates);

    const [t] = await db.insert(sessionTemplates).values({
      userId: TEST_USER.id,
      name: "My Template",
      type: "behavioral",
      config: { company_name: "Google" },
    }).returning();
    testTemplateId = t.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // --- GET ---
  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(testTemplateId), makeParams(testTemplateId));
    expect(res.status).toBe(401);
  });

  it("GET returns 404 for another user's template", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await GET(makeRequest(testTemplateId), makeParams(testTemplateId));
    expect(res.status).toBe(404);
  });

  it("GET returns the template", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await GET(makeRequest(testTemplateId), makeParams(testTemplateId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("My Template");
  });

  // --- PATCH ---
  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest(testTemplateId, "PATCH", { name: "New" }), makeParams(testTemplateId));
    expect(res.status).toBe(401);
  });

  it("PATCH returns 404 for another user's template", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await PATCH(makeRequest(testTemplateId, "PATCH", { name: "New" }), makeParams(testTemplateId));
    expect(res.status).toBe(404);
  });

  it("PATCH updates name", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makeRequest(testTemplateId, "PATCH", { name: "Updated" }), makeParams(testTemplateId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated");
  });

  it("PATCH updates config", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(
      makeRequest(testTemplateId, "PATCH", { config: { company_name: "Meta" } }),
      makeParams(testTemplateId)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.config.company_name).toBe("Meta");
  });

  it("PATCH returns 400 for empty body", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await PATCH(makeRequest(testTemplateId, "PATCH", {}), makeParams(testTemplateId));
    expect(res.status).toBe(400);
  });

  // --- DELETE ---
  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(testTemplateId, "DELETE"), makeParams(testTemplateId));
    expect(res.status).toBe(401);
  });

  it("DELETE returns 404 for another user's template", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await DELETE(makeRequest(testTemplateId, "DELETE"), makeParams(testTemplateId));
    expect(res.status).toBe(404);
  });

  it("DELETE removes the template", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await DELETE(makeRequest(testTemplateId, "DELETE"), makeParams(testTemplateId));
    expect(res.status).toBe(200);

    const db = getTestDb();
    const remaining = await db.select().from(sessionTemplates).where(eq(sessionTemplates.id, testTemplateId));
    expect(remaining).toHaveLength(0);
  });
});
