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
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = getTestDb();
    await db.delete(sessionFeedback);
    await db.delete(codeSnapshots);
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
});
