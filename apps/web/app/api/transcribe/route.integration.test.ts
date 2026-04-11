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
import { users, interviewSessions } from "@/lib/schema";

// Mock auth — only external auth is mocked
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the real test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock OpenAI — external API, must be mocked
const mockTranscriptionCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: mockTranscriptionCreate,
        },
      };
    },
  };
});

import { POST } from "./route";

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

let testSessionId: string;

/**
 * Build a mock request whose `.formData()` returns a fake FormData.
 * This avoids jsdom/undici Blob incompatibility issues with multipart requests.
 */
function buildMockRequest(fields: Record<string, unknown>) {
  const map = new Map(Object.entries(fields));
  return {
    formData: async () => ({
      get: (key: string) => map.get(key) ?? null,
    }),
  } as never;
}

function fakeFile(size = 100) {
  return new File(["x".repeat(size)], "audio.webm", { type: "audio/webm" });
}

describe("POST /api/transcribe (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-key";

    const db = getTestDb();
    await db.delete(interviewSessions);

    // Create a fresh session owned by TEST_USER
    const [session] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        config: { interview_type: "leetcode", focus_areas: ["arrays"] },
      })
      .returning();
    testSessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: testSessionId,
    }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when audio file is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const response = await POST(buildMockRequest({
      session_id: testSessionId,
    }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/audio/i);
  });

  it("returns 400 when session_id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
    }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/session_id/i);
  });

  it("returns 404 when session not found (real DB lookup)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: "00000000-0000-0000-0000-000000000099",
    }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when session owned by another user (real DB lookup)", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: testSessionId,
    }));
    expect(response.status).toBe(404);
  });

  it("returns transcript entry on successful transcription", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockTranscriptionCreate.mockResolvedValue({
      text: "I think we should use a hash map",
    });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: testSessionId,
    }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].speaker).toBe("user");
    expect(body.entries[0].text).toBe("I think we should use a hash map");
    expect(body.entries[0].timestamp_ms).toBe(0);
  });

  it("returns empty entries when transcription text is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockTranscriptionCreate.mockResolvedValue({
      text: "  ",
    });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: testSessionId,
    }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(0);
  });
});
