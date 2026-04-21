import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../../tests/setup-db";
import {
  users,
  interviewSessions,
  transcripts,
  codeSnapshots,
  sessionFeedback,
  gazeSamples,
} from "@/lib/schema";
import { eq } from "drizzle-orm";

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

import {
  BEHAVIORAL_SYSTEM_PROMPT,
  BEHAVIORAL_SYSTEM_PROMPT_PRO,
  TECHNICAL_SYSTEM_PROMPT,
  TECHNICAL_SYSTEM_PROMPT_PRO,
} from "@/lib/analysis-prompts";

// Mock OpenAI at module scope — same pattern as the analysis route integration
// tests. The extracted `runBehavioralAnalysis` / `runTechnicalAnalysis` lib
// functions run for real against this mock.
const mockChatCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-integration-test");

import { GET, POST } from "./route";

const BEHAVIORAL_GPT_RESPONSE_RAW = readFileSync(
  join(__dirname, "..", "..", "..", "analysis", "__fixtures__", "behavioral-gpt-response.json"),
  "utf-8",
);
const TECHNICAL_GPT_RESPONSE_RAW = readFileSync(
  join(__dirname, "..", "..", "..", "analysis", "__fixtures__", "technical-gpt-response.json"),
  "utf-8",
);

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

const PRO_USER = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "pro@example.com",
  name: "Pro User",
  plan: "pro" as const,
};

let behavioralSessionId: string;
let technicalSessionId: string;

function makePostRequest(sessionId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/feedback`,
    { method: "POST" }
  );
}

function makeGetRequest(sessionId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/feedback`,
    { method: "GET" }
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const SAMPLE_TRANSCRIPT = [
  { speaker: "ai", text: "Tell me about a challenge", timestamp_ms: 0 },
  { speaker: "user", text: "I led a migration project", timestamp_ms: 3000 },
];

describe("API /api/sessions/[id]/feedback (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
    await db.insert(users).values(OTHER_USER).onConflictDoNothing();
    await db.insert(users).values(PRO_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = getTestDb();
    await db.delete(sessionFeedback);
    await db.delete(codeSnapshots);
    await db.delete(gazeSamples);
    await db.delete(transcripts);
    await db.delete(interviewSessions);

    // Create a behavioral session with transcript
    const [bSession] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "behavioral",
        config: { interview_style: 0.5, difficulty: 0.5 },
      })
      .returning();
    behavioralSessionId = bSession.id;

    await db.insert(transcripts).values({
      sessionId: behavioralSessionId,
      entries: SAMPLE_TRANSCRIPT,
    });

    // Create a technical session with transcript + snapshots
    const [tSession] = await db
      .insert(interviewSessions)
      .values({
        userId: TEST_USER.id,
        type: "technical",
        config: { interview_type: "leetcode", focus_areas: ["arrays"], language: "python", difficulty: "medium" },
      })
      .returning();
    technicalSessionId = tSession.id;

    await db.insert(transcripts).values({
      sessionId: technicalSessionId,
      entries: SAMPLE_TRANSCRIPT,
    });

    await db.insert(codeSnapshots).values([
      {
        sessionId: technicalSessionId,
        code: "def solution(): pass",
        language: "python",
        timestampMs: 1000,
        eventType: "edit",
      },
      {
        sessionId: technicalSessionId,
        code: "def solution(nums):\n    return max(nums)",
        language: "python",
        timestampMs: 5000,
        eventType: "submit",
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  // ---- GET tests ----

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(
      makeGetRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(401);
  });

  it("GET returns 404 when session belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const res = await GET(
      makeGetRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(404);
  });

  it("GET returns 404 when feedback not yet generated", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const res = await GET(
      makeGetRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not yet generated/i);
  });

  it("GET returns 200 with existing feedback", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed feedback
    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: behavioralSessionId,
      overallScore: 7.5,
      summary: "Good job",
      strengths: ["a", "b"],
      weaknesses: ["c"],
      answerAnalyses: [],
    });

    const res = await GET(
      makeGetRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overallScore).toBe(7.5);
    expect(body.summary).toBe("Good job");
    expect(body.type).toBe("behavioral");
  });

  it("GET returns 200 with type: 'technical' and codeQualityScore for a completed technical session", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed technical feedback
    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: technicalSessionId,
      overallScore: 7.5,
      summary: "Solid interview performance.",
      strengths: ["Clear examples", "Good structure", "Specific details"],
      weaknesses: ["Could improve follow-up", "Needs more metrics", "Short answers"],
      answerAnalyses: [],
      codeQualityScore: 6.5,
      explanationQualityScore: 8.0,
      timelineAnalysis: [
        { timestamp_ms: 0, event_type: "speech", summary: "Explained approach" },
        { timestamp_ms: 3000, event_type: "code_change", summary: "Changed code" },
      ],
    });

    const res = await GET(
      makeGetRequest(technicalSessionId),
      makeParams(technicalSessionId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("technical");
    expect(body.codeQualityScore).toBe(6.5);
    expect(body.explanationQualityScore).toBe(8.0);
    expect(body.timelineAnalysis).toHaveLength(2);
  });

  // ---- POST tests ----

  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(401);
  });

  it("POST returns 404 when session belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER.id } });

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(404);
  });

  it("POST returns 400 when no transcript exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Create a session without a transcript
    const db = getTestDb();
    const [noTranscriptSession] = await db
      .insert(interviewSessions)
      .values({ userId: TEST_USER.id, type: "behavioral", config: {} })
      .returning();

    const res = await POST(
      makePostRequest(noTranscriptSession.id),
      makeParams(noTranscriptSession.id)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/transcript/i);
  });

  it("POST returns existing feedback if already generated (idempotency)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed existing feedback
    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: behavioralSessionId,
      overallScore: 8.0,
      summary: "Already exists",
      strengths: [],
      weaknesses: [],
      answerAnalyses: [],
    });

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overallScore).toBe(8.0);
    expect(body.summary).toBe("Already exists");

    // GPT should NOT have been called
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it("POST regenerates feedback when existing technical row has null codeQualityScore (incomplete)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed an incomplete/stale technical feedback row.
    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: technicalSessionId,
      overallScore: 5,
      summary: "stale",
      strengths: [],
      weaknesses: [],
      answerAnalyses: [],
      codeQualityScore: null,
      explanationQualityScore: null,
      timelineAnalysis: null,
    });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: TECHNICAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(technicalSessionId),
      makeParams(technicalSessionId)
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.codeQualityScore).toBe(6.5);
    expect(body.explanationQualityScore).toBe(7.5);

    // GPT path was invoked exactly once.
    expect(mockChatCreate).toHaveBeenCalledOnce();

    // Real SELECT: exactly one row, all three technical fields non-null.
    const rows = await db
      .select()
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, technicalSessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0].codeQualityScore).toBe(6.5);
    expect(rows[0].explanationQualityScore).toBe(7.5);
    expect(rows[0].timelineAnalysis).not.toBeNull();
  });

  it("POST returns existing row and does not call GPT when technical feedback is fully populated", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: technicalSessionId,
      overallScore: 9.0,
      summary: "Already complete",
      strengths: ["a"],
      weaknesses: ["b"],
      answerAnalyses: [],
      codeQualityScore: 9.0,
      explanationQualityScore: 9.0,
      timelineAnalysis: [
        { timestamp_ms: 0, event_type: "speech", summary: "ok" },
      ],
    });

    const res = await POST(
      makePostRequest(technicalSessionId),
      makeParams(technicalSessionId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.codeQualityScore).toBe(9.0);
    expect(body.explanationQualityScore).toBe(9.0);

    // No GPT call made.
    expect(mockChatCreate).not.toHaveBeenCalled();

    // DB still has exactly one row.
    const rows = await db
      .select()
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, technicalSessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0].codeQualityScore).toBe(9.0);
  });

  it("POST 201 triggers behavioral analysis and persists feedback", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(201);

    // GPT called exactly once — no URL assertion, no fetch mocking.
    expect(mockChatCreate).toHaveBeenCalledOnce();

    // Verify persisted in DB via real SELECT.
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, behavioralSessionId));
    expect(row).toBeDefined();
    expect(row.overallScore).toBe(7.5);
    expect(row.strengths).toHaveLength(3);
    expect(row.weaknesses).toHaveLength(3);
    expect(row.answerAnalyses).not.toBeNull();
  });

  it("POST 201 triggers technical analysis with code snapshots", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: TECHNICAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(technicalSessionId),
      makeParams(technicalSessionId)
    );
    expect(res.status).toBe(201);

    expect(mockChatCreate).toHaveBeenCalledOnce();

    // Verify technical-specific fields persisted via real SELECT.
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, technicalSessionId));
    expect(row).toBeDefined();
    expect(row.codeQualityScore).toBe(6.5);
    expect(row.explanationQualityScore).toBe(7.5);
    expect(row.overallScore).toBeDefined();
    expect(row.timelineAnalysis).not.toBeNull();

    // Timeline comes from buildTimeline(transcript, snapshots), not from the
    // GPT fixture. Assert structural shape only.
    const timeline = row.timelineAnalysis as Array<{
      event_type: string;
      summary: string;
    }>;
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    for (const entry of timeline) {
      expect(entry.event_type).toBeDefined();
      expect(entry.summary).toBeDefined();
    }
  });

  it("POST returns 500 when GPT exhausts retries", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Both attempts return invalid JSON — forces retry exhaustion.
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "not json at all" } }],
    });

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/feedback generation failed|malformed|unknown error/i);

    // The retry loop in withOpenAIRetry attempts twice before throwing.
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("POST for behavioral session with gaze samples persists gaze columns", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    // Seed gaze samples for this session (center-looking samples spanning > 50% of a 10s session)
    const db = getTestDb();
    const centerSamples = Array.from({ length: 12 }, (_, i) => ({
      t: i * 500,
      gaze_x: 0,
      gaze_y: 0,
      head_yaw: 0,
      head_pitch: 0,
      confidence: 0.9,
    }));
    await db.insert(gazeSamples).values({
      sessionId: behavioralSessionId,
      samples: centerSamples,
    });

    // Update session duration so coverage calculation works
    await db
      .update(interviewSessions)
      .set({ durationSeconds: 10 })
      .where(eq(interviewSessions.id, behavioralSessionId));

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(201);

    // Verify gaze columns were persisted in the DB
    const [row] = await db
      .select()
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, behavioralSessionId));
    expect(row).toBeDefined();
    expect(row.gazeConsistencyScore).not.toBeNull();
    expect(row.gazeConsistencyScore).toBe(100); // all center samples → 100
    expect(row.gazeCoverage).not.toBeNull();
    expect(row.gazeDistribution).not.toBeNull();
    expect(row.gazeTimeline).not.toBeNull();
  });

  it("GET returns gaze fields in response after they are persisted", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });

    // Seed feedback with gaze columns populated
    const db = getTestDb();
    await db.insert(sessionFeedback).values({
      sessionId: behavioralSessionId,
      overallScore: 7.5,
      summary: "Great job",
      strengths: ["a"],
      weaknesses: ["b"],
      answerAnalyses: [],
      gazeConsistencyScore: 82.5,
      gazeDistribution: {
        center_pct: 82.5,
        up_pct: 5,
        down_pct: 5,
        left_pct: 5,
        right_pct: 2.5,
        off_screen_pct: 0,
      },
      gazeCoverage: 0.88,
      gazeTimeline: [
        { bucket_start_s: 0, dominant_zone: "center", center_pct: 90 },
      ],
    });

    const res = await GET(
      makeGetRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gazeConsistencyScore).toBe(82.5);
    expect(body.gazeCoverage).toBe(0.88);
    expect(body.gazeDistribution).not.toBeNull();
    expect(body.gazeDistribution.center_pct).toBe(82.5);
    expect(body.gazeTimeline).toHaveLength(1);
  });

  // ---- Tier / model selection tests ----

  it("POST uses gpt-5.4-mini + Free system prompt for Free users (behavioral)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(res.status).toBe(201);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5.4-mini");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT);
  });

  it("POST uses PRO_ANALYSIS_MODEL + Pro system prompt for Pro users (behavioral)", async () => {
    const db = getTestDb();
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    // Create a behavioral session owned by the Pro user
    const [proSession] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "behavioral",
        config: { interview_style: 0.5, difficulty: 0.5 },
      })
      .returning();

    await db.insert(transcripts).values({
      sessionId: proSession.id,
      entries: SAMPLE_TRANSCRIPT,
    });

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(proSession.id),
      makeParams(proSession.id)
    );
    expect(res.status).toBe(201);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5-test-pro");
    expect(call.messages[0].content).toBe(BEHAVIORAL_SYSTEM_PROMPT_PRO);
  });

  it("POST uses gpt-5.4-mini for Free users (technical)", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: TECHNICAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(technicalSessionId),
      makeParams(technicalSessionId)
    );
    expect(res.status).toBe(201);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5.4-mini");
    expect(call.messages[0].content).toBe(TECHNICAL_SYSTEM_PROMPT);
  });

  it("POST uses PRO_ANALYSIS_MODEL for Pro users (technical)", async () => {
    const db = getTestDb();
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    // Create a technical session owned by the Pro user
    const [proTechSession] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "technical",
        config: { interview_type: "leetcode", focus_areas: ["arrays"], language: "python", difficulty: "medium" },
      })
      .returning();

    await db.insert(transcripts).values({
      sessionId: proTechSession.id,
      entries: SAMPLE_TRANSCRIPT,
    });

    await db.insert(codeSnapshots).values([
      {
        sessionId: proTechSession.id,
        code: "def solution(): pass",
        language: "python",
        timestampMs: 1000,
        eventType: "edit",
      },
    ]);

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: TECHNICAL_GPT_RESPONSE_RAW } }],
    });

    const res = await POST(
      makePostRequest(proTechSession.id),
      makeParams(proTechSession.id)
    );
    expect(res.status).toBe(201);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const call = mockChatCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-5-test-pro");
    expect(call.messages[0].content).toBe(TECHNICAL_SYSTEM_PROMPT_PRO);
  });

  it("POST re-reads the plan on each request (downgrade semantics)", async () => {
    const db = getTestDb();
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    // Create a behavioral session owned by Pro user
    const [proSession] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "behavioral",
        config: { interview_style: 0.5, difficulty: 0.5 },
      })
      .returning();

    await db.insert(transcripts).values({
      sessionId: proSession.id,
      entries: SAMPLE_TRANSCRIPT,
    });

    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    // First POST — Pro user → should use Pro model
    const res1 = await POST(
      makePostRequest(proSession.id),
      makeParams(proSession.id)
    );
    expect(res1.status).toBe(201);
    const call1 = mockChatCreate.mock.calls[0][0];
    expect(call1.model).toBe("gpt-5-test-pro");

    // Downgrade: flip plan to "free" in DB
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.id, PRO_USER.id));

    // Clean up the feedback row so we can POST again
    await db
      .delete(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, proSession.id));

    vi.clearAllMocks();
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    // Second POST — plan now "free" → should use Free model
    const res2 = await POST(
      makePostRequest(proSession.id),
      makeParams(proSession.id)
    );
    expect(res2.status).toBe(201);
    const call2 = mockChatCreate.mock.calls[0][0];
    expect(call2.model).toBe("gpt-5.4-mini");

    // Restore Pro plan to not pollute other tests' PRO_USER assertions
    await db
      .update(users)
      .set({ plan: "pro" })
      .where(eq(users.id, PRO_USER.id));
  });

  it("POST persists the same response shape regardless of tier", async () => {
    const db = getTestDb();
    vi.stubEnv("PRO_ANALYSIS_MODEL", "gpt-5-test-pro");

    // Create a Pro session
    const [proSession] = await db
      .insert(interviewSessions)
      .values({
        userId: PRO_USER.id,
        type: "behavioral",
        config: { interview_style: 0.5, difficulty: 0.5 },
      })
      .returning();

    await db.insert(transcripts).values({
      sessionId: proSession.id,
      entries: SAMPLE_TRANSCRIPT,
    });

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    // POST as Free user (TEST_USER owns behavioralSessionId)
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const resFree = await POST(
      makePostRequest(behavioralSessionId),
      makeParams(behavioralSessionId)
    );
    expect(resFree.status).toBe(201);
    const freeBody = await resFree.json();

    vi.clearAllMocks();
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: BEHAVIORAL_GPT_RESPONSE_RAW } }],
    });

    // POST as Pro user
    mockAuth.mockResolvedValue({ user: { id: PRO_USER.id } });
    const resPro = await POST(
      makePostRequest(proSession.id),
      makeParams(proSession.id)
    );
    expect(resPro.status).toBe(201);
    const proBody = await resPro.json();

    // Both rows must have the same DB column set populated — no new columns
    const freeKeys = Object.keys(freeBody).sort();
    const proKeys = Object.keys(proBody).sort();
    expect(proKeys).toEqual(freeKeys);

    // Core response fields present in both
    expect(freeBody.overallScore).toBeDefined();
    expect(proBody.overallScore).toBeDefined();
    expect(freeBody.summary).toBeDefined();
    expect(proBody.summary).toBeDefined();
    expect(freeBody.strengths).toBeDefined();
    expect(proBody.strengths).toBeDefined();
    expect(freeBody.answerAnalyses).toBeDefined();
    expect(proBody.answerAnalyses).toBeDefined();
  });
});
