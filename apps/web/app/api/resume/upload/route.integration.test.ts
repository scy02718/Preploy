import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../../tests/setup-db";
import { users, userResumes } from "@/lib/schema";

// Use vi.hoisted so mockParseResume is available when vi.mock factories run
const { mockAuth, mockParseResume } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockParseResume: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Point db import to the test database
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Mock the resume parser
vi.mock("@/lib/resume-parser", () => ({
  parseResume: mockParseResume,
}));

import { POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test-upload@example.com",
  name: "Test User",
};

/**
 * Creates a NextRequest with formData() mocked to return a FormData
 * containing a File-like Blob. This avoids jsdom multipart parsing issues.
 */
function makeUploadRequest(content: string | null, filename: string, mimeType: string): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/resume/upload", {
    method: "POST",
  });

  if (content !== null) {
    const blob = new Blob([content], { type: mimeType });
    // Create a File-like object with name property
    const file = Object.assign(blob, { name: filename });
    const formData = new FormData();
    formData.append("file", file as unknown as File, filename);

    // Override formData() to return our manually-constructed FormData
    req.formData = async () => formData;
  }

  return req;
}

const MOCK_STRUCTURED = {
  roles: [
    {
      company: "Acme Corp",
      title: "Engineer",
      dates: "2020-2023",
      bullets: [{ text: "Did stuff", impact_score: 5, has_quantified_metric: false }],
    },
  ],
  skills: ["TypeScript"],
};

describe("API POST /api/resume/upload (integration)", () => {
  beforeAll(async () => {
    const db = getTestDb();
    await db.insert(users).values(TEST_USER).onConflictDoNothing();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockParseResume.mockResolvedValue(MOCK_STRUCTURED);
    const db = getTestDb();
    await db.delete(userResumes);
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeUploadRequest("resume text", "resume.txt", "text/plain"));
    expect(res.status).toBe(401);
  });

  it("populates structured_data in DB when parser succeeds", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockParseResume.mockResolvedValue(MOCK_STRUCTURED);
    const content = "John Doe\nSoftware Engineer\n5 years experience";
    const res = await POST(makeUploadRequest(content, "resume.txt", "text/plain"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.structuredData).not.toBeNull();
    expect(data.structuredData.roles[0].company).toBe("Acme Corp");

    // Verify persisted in DB
    const db = getTestDb();
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(userResumes).where(eq(userResumes.id, data.id));
    expect(row.structuredData).not.toBeNull();
  });

  it("succeeds with structured_data: null when parser throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    mockParseResume.mockRejectedValue(new Error("Parse failure"));
    const content = "John Doe\nEngineer";
    const res = await POST(makeUploadRequest(content, "resume2.txt", "text/plain"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.structuredData).toBeNull();
  });

  it("returns 400 when no file is provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const req = new NextRequest("http://localhost:3000/api/resume/upload", {
      method: "POST",
    });
    req.formData = async () => new FormData();
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No file");
  });

  it("returns 400 for unsupported file type", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeUploadRequest("data", "resume.docx", "application/vnd.openxmlformats"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("PDF, TXT, or MD");
  });

  it("returns 400 for empty file content", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeUploadRequest("   ", "resume.txt", "text/plain"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("no extractable text");
  });

  it("successfully uploads a text file", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const content = "John Doe\nSoftware Engineer\nExperience: 5 years";
    const res = await POST(makeUploadRequest(content, "resume.txt", "text/plain"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.filename).toBe("resume.txt");
    expect(data.content).toBe(content);
    expect(data.createdAt).toBeDefined();
  });

  it("successfully saves pasted resume text via JSON body", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(
      new NextRequest("http://localhost:3000/api/resume/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Pasted resume content here" }),
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.content).toBe("Pasted resume content here");
    expect(data.filename).toBe("pasted-resume.txt");
  });

  it("stores the resume in the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: TEST_USER.id } });
    const res = await POST(makeUploadRequest("My resume content", "test.txt", "text/plain"));
    expect(res.status).toBe(201);

    const db = getTestDb();
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(userResumes)
      .where(eq(userResumes.userId, TEST_USER.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].filename).toBe("test.txt");
    expect(rows[0].content).toBe("My resume content");
  });
});
