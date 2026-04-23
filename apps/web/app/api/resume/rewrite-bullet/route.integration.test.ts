import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, userResumes } from "@/lib/schema";

// Use vi.hoisted so mocks are available when vi.mock factories run
const { mockAuth, mockCreate, mockCheckRateLimit } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCreate: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock OpenAI constructor — lazy-init in the route, so we mock the class
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// Mock rate limiting — allow by default
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000021",
  email: "test-rewrite@example.com",
  name: "Rewrite Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000022",
  email: "other-rewrite@example.com",
  name: "Other Rewrite User",
};

let testResumeId: string;
let otherResumeId: string;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/resume/rewrite-bullet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_VARIANTS = [
  "Led 15-person engineering team to deliver migration on time, reducing latency by 40%",
  "Drove architecture migration, improving system throughput by 40% and eliminating 3 critical bottlenecks",
  "Spearheaded monolith-to-microservices migration for 50k+ users, cutting P99 latency by 40%",
];

describe("API POST /api/resume/rewrite-bullet (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();

    const [resume] = await db
      .insert(userResumes)
      .values({
        userId: TEST_USER.id,
        filename: "test-resume.txt",
        content: "Led migration of monolith to microservices, reducing latency",
      })
      .returning();
    testResumeId = resume.id;

    const [other] = await db
      .insert(userResumes)
      .values({
        userId: OTHER_USER.id,
        filename: "other-resume.txt",
        content: "Other user resume content",
      })
      .returning();
    otherResumeId = other.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default after clearAllMocks
    mockCheckRateLimit.mockResolvedValue(null);

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ variants: MOCK_VARIANTS }),
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ resumeId: testResumeId, bullet: "Did some work" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (missing bullet)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ resumeId: testResumeId }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request");
  });

  it("returns 400 for invalid resumeId format (not uuid)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeRequest({ resumeId: "not-a-uuid", bullet: "Did some work" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when resumeId belongs to another user (authorization)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({ resumeId: otherResumeId, bullet: "Did some work" })
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("happy path: returns exactly 3 variants", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest({
        resumeId: testResumeId,
        bullet: "Participated in team meetings",
        roleTitle: "Software Engineer",
        roleCompany: "Acme Corp",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.variants)).toBe(true);
    expect(data.variants).toHaveLength(3);
    data.variants.forEach((v: unknown) => expect(typeof v).toBe("string"));
  });

  it("DB row is unchanged after call (no write side-effect)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const db = getTestDb();
    const { eq } = await import("drizzle-orm");

    // Snapshot the row before
    const [before] = await db.select().from(userResumes).where(eq(userResumes.id, testResumeId));

    await POST(makeRequest({ resumeId: testResumeId, bullet: "Did some work" }));

    // Snapshot the row after
    const [after] = await db.select().from(userResumes).where(eq(userResumes.id, testResumeId));
    expect(after.content).toBe(before.content);
    expect(after.structuredData).toEqual(before.structuredData);
  });

  it("returns 500 when OpenAI throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockCreate.mockRejectedValue(new Error("OpenAI error"));
    const res = await POST(
      makeRequest({ resumeId: testResumeId, bullet: "Did some work" })
    );
    expect(res.status).toBe(500);
  });
});
