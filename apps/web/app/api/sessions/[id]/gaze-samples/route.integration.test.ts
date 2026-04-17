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
} from "../../../../../tests/setup-db";
import { users, interviewSessions, gazeSamples } from "@/lib/schema";
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

// checkRateLimit is a no-op in tests
vi.mock("@/lib/api-utils", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000011",
  email: "gaze-test@example.com",
  name: "Gaze Test User",
};

const OTHER_USER = {
  id: "00000000-0000-0000-0000-000000000012",
  email: "gaze-other@example.com",
  name: "Other Gaze User",
};

const TEST_SESSION_ID = "00000000-0000-0000-0000-000000000021";
const OTHER_SESSION_ID = "00000000-0000-0000-0000-000000000022";

function makeRequest(sessionId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/gaze-samples`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const VALID_SAMPLE = {
  t: 0,
  gaze_x: 0.1,
  gaze_y: -0.2,
  head_yaw: 5,
  head_pitch: -3,
  confidence: 0.9,
};

const VALID_BODY = { samples: [VALID_SAMPLE] };

describe("POST /api/sessions/[id]/gaze-samples (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();

    // Enable gaze tracking for TEST_USER
    await db
      .update(users)
      .set({ gazeTrackingEnabled: true })
      .where(eq(users.id, TEST_USER.id));

    // Create a session owned by TEST_USER
    await db
      .insert(interviewSessions)
      .values({
        id: TEST_SESSION_ID,
        userId: TEST_USER.id,
        type: "behavioral",
        status: "completed",
      })
      .onConflictDoNothing();

    // Create a session owned by OTHER_USER
    await db
      .insert(interviewSessions)
      .values({
        id: OTHER_SESSION_ID,
        userId: OTHER_USER.id,
        type: "behavioral",
        status: "completed",
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up any gaze samples between tests
    const db = getTestDb();
    await db.delete(gazeSamples).where(eq(gazeSamples.sessionId, TEST_SESSION_ID));
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(TEST_SESSION_ID, VALID_BODY), makeParams(TEST_SESSION_ID));
    expect(res.status).toBe(401);
  });

  it("returns 404 for a nonexistent session", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const nonexistentId = "00000000-0000-0000-0000-000000000099";
    const res = await POST(
      makeRequest(nonexistentId, VALID_BODY),
      makeParams(nonexistentId)
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's session (does not leak existence)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest(OTHER_SESSION_ID, VALID_BODY),
      makeParams(OTHER_SESSION_ID)
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when gaze_tracking_enabled is false for the authenticated user", async () => {
    // OTHER_USER owns OTHER_SESSION_ID but has gaze tracking disabled
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });
    const res = await POST(
      makeRequest(OTHER_SESSION_ID, VALID_BODY),
      makeParams(OTHER_SESSION_ID)
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not enabled/i);
  });

  it("returns 400 for missing samples field", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest(TEST_SESSION_ID, {}),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty samples array", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      makeRequest(TEST_SESSION_ID, { samples: [] }),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for out-of-bounds gaze_x value", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const invalidBody = {
      samples: [{ ...VALID_SAMPLE, gaze_x: 1.5 }],
    };
    const res = await POST(
      makeRequest(TEST_SESSION_ID, invalidBody),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for out-of-bounds head_yaw value", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const invalidBody = {
      samples: [{ ...VALID_SAMPLE, head_yaw: 200 }],
    };
    const res = await POST(
      makeRequest(TEST_SESSION_ID, invalidBody),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for array exceeding 3600 samples", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const overSized = { samples: Array(3601).fill(VALID_SAMPLE) };
    const res = await POST(
      makeRequest(TEST_SESSION_ID, overSized),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 on happy path and persists gaze samples", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const body = {
      samples: [
        VALID_SAMPLE,
        { t: 500, gaze_x: -0.3, gaze_y: 0.1, head_yaw: -10, head_pitch: 5, confidence: 0.85 },
      ],
    };
    const res = await POST(
      makeRequest(TEST_SESSION_ID, body),
      makeParams(TEST_SESSION_ID)
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.sessionId).toBe(TEST_SESSION_ID);
    expect(data.createdAt).toBeTruthy();

    // Verify persisted in DB
    const db = getTestDb();
    const rows = await db
      .select()
      .from(gazeSamples)
      .where(eq(gazeSamples.sessionId, TEST_SESSION_ID));
    expect(rows).toHaveLength(1);
    const storedSamples = rows[0].samples as typeof body.samples;
    expect(storedSamples).toHaveLength(2);
    expect(storedSamples[0].t).toBe(0);
    expect(storedSamples[0].gaze_x).toBe(0.1);
  });

  it("returns 201 on upsert — second POST replaces, only one row exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // First POST
    await POST(
      makeRequest(TEST_SESSION_ID, { samples: [VALID_SAMPLE] }),
      makeParams(TEST_SESSION_ID)
    );

    // Second POST with different samples
    const newSample = {
      t: 1000,
      gaze_x: 0.5,
      gaze_y: 0.5,
      head_yaw: 15,
      head_pitch: -5,
      confidence: 0.7,
    };
    const res2 = await POST(
      makeRequest(TEST_SESSION_ID, { samples: [newSample] }),
      makeParams(TEST_SESSION_ID)
    );
    expect(res2.status).toBe(201);

    // Verify only one row exists
    const db = getTestDb();
    const rows = await db
      .select()
      .from(gazeSamples)
      .where(eq(gazeSamples.sessionId, TEST_SESSION_ID));
    expect(rows).toHaveLength(1);
    const stored = rows[0].samples as typeof newSample[];
    // Should be the new sample, not the original
    expect(stored[0].t).toBe(1000);
  });
});
