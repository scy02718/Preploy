import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock db — mock the chained select().from().where() pattern
const mockWhere = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockWhere,
      }),
    }),
  },
}));

// Mock OpenAI
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

// Mock schema to avoid drizzle import issues
vi.mock("@/lib/schema", () => ({
  interviewSessions: { id: "id", userId: "userId" },
}));

import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

/**
 * Build a mock NextRequest whose `.formData()` returns a fake FormData.
 * This avoids jsdom/undici Blob incompatibility issues.
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

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: "session-1",
    }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when audio file is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(buildMockRequest({ session_id: "session-1" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/audio/i);
  });

  it("returns 400 when session_id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(buildMockRequest({ audio: fakeFile() }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/session_id/i);
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockWhere.mockResolvedValue([]);

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: "nonexistent",
    }));
    expect(response.status).toBe(404);
  });

  it("returns transcript entries on successful transcription", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockWhere.mockResolvedValue([{ id: "session-1", userId: "user-1" }]);
    mockTranscriptionCreate.mockResolvedValue({
      text: "I think we should use a hash map",
      words: [
        { word: "I", start: 0.0, end: 0.1 },
        { word: "think", start: 0.15, end: 0.4 },
        { word: "we", start: 0.45, end: 0.55 },
        { word: "should", start: 0.6, end: 0.85 },
        { word: "use", start: 0.9, end: 1.1 },
        { word: "a", start: 1.15, end: 1.2 },
        { word: "hash", start: 1.25, end: 1.5 },
        { word: "map", start: 1.55, end: 1.8 },
      ],
    });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: "session-1",
    }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].speaker).toBe("user");
    expect(body.entries[0].text).toBe("I think we should use a hash map");
    expect(body.entries[0].timestamp_ms).toBe(0);
  });

  it("handles transcription with pauses creating multiple segments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockWhere.mockResolvedValue([{ id: "session-1", userId: "user-1" }]);
    mockTranscriptionCreate.mockResolvedValue({
      text: "first part second part",
      words: [
        { word: "first", start: 0.0, end: 0.3 },
        { word: "part", start: 0.35, end: 0.6 },
        { word: "second", start: 2.6, end: 2.9 },
        { word: "part", start: 2.95, end: 3.2 },
      ],
    });

    const response = await POST(buildMockRequest({
      audio: fakeFile(),
      session_id: "session-1",
    }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].text).toBe("first part");
    expect(body.entries[1].text).toBe("second part");
    expect(body.entries[1].timestamp_ms).toBe(2600);
  });
});
