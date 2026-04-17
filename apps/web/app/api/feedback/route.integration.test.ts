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
import { users } from "@/lib/schema";

// --- Mock auth ---------------------------------------------------------------
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

// --- Point db at test database -----------------------------------------------
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// --- Mock sendEmail so we can capture call args ------------------------------
const mockSendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));

// --- Mock checkRateLimit so we control 429 behaviour -------------------------
const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

import { POST } from "./route";

// ---------------------------------------------------------------------------

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "feedback-test@example.com",
  name: "Feedback Tester",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(raw: string): NextRequest {
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

describe("POST /api/feedback (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: not rate-limited
    mockCheckRateLimit.mockResolvedValue(null);
    // Default: sendEmail resolves with nothing (fire-and-forget)
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // 109-1: 401 when unauthenticated
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest({ message: "Hello world!" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // 109-2a: 400 for invalid JSON
  it("returns 400 for invalid JSON body", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
    const req = makeRawRequest("not json at all");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  // 109-2b: 400 for message too short
  it("returns 400 when message is shorter than 5 characters", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
    const req = makeRequest({ message: "Hi" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  // 109-2c: 400 for message too long
  it("returns 400 when message exceeds 5000 characters", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
    const req = makeRequest({ message: "a".repeat(5001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  // 109-4: 429 when rate-limited
  it("returns 429 when rate limit is exceeded", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    );
    const req = makeRequest({ message: "This is a valid message" });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  // 109-3: Happy path — Resend called with correct to/from/body
  it("happy path: calls sendEmail with correct recipient and returns success", async () => {
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
    });
    const req = makeRequest({
      type: "Bug",
      message: "The login button is broken on mobile.",
      page: "/dashboard",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify sendEmail was called once with the correct recipient
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const callArgs = mockSendEmail.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(callArgs.to).toBe("preploy.dev@gmail.com");
    expect(callArgs.subject).toContain("Bug");
    expect(callArgs.html).toContain("The login button is broken on mobile.");
  });

  // 109-5: Type defaulting — omitted type defaults to "Other"
  it("defaults type to 'Other' when type is omitted", async () => {
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
    });
    const req = makeRequest({ message: "General feedback about the app." });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const callArgs = mockSendEmail.mock.calls[0][0] as { subject: string };
    expect(callArgs.subject).toContain("Other");
  });

  // 109-3 (extra): verify recipient is always preploy.dev@gmail.com (never the stale tech domain)
  it("never sends to the stale preploy-tech email — always uses preploy.dev@gmail.com", async () => {
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
    });
    const req = makeRequest({
      type: "Feature Request",
      message: "Please add dark mode to the app.",
    });
    await POST(req);
    const callArgs = mockSendEmail.mock.calls[0][0] as { to: string };
    expect(callArgs.to).not.toContain("preploy.tech");
    expect(callArgs.to).toBe("preploy.dev@gmail.com");
  });
});
