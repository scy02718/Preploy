import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock OpenAI
const mockChatCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockChatCreate,
      },
    };
  },
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/problems/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_CONFIG = {
  interview_type: "leetcode",
  focus_areas: ["arrays"],
  language: "python",
  difficulty: "medium",
};

const VALID_PROBLEM_JSON = JSON.stringify({
  title: "Two Sum",
  difficulty: "Medium",
  description: "Given an array of integers...",
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9" },
  ],
  constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
});

describe("POST /api/problems/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(makeRequest({ config: VALID_CONFIG }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid config", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(makeRequest({ config: { interview_type: "invalid" } }));
    expect(response.status).toBe(400);
  });

  it("returns a valid Problem on successful generation", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_PROBLEM_JSON } }],
    });

    const response = await POST(makeRequest({ config: VALID_CONFIG }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.title).toBe("Two Sum");
    expect(body.difficulty).toBe("Medium");
    expect(body.examples).toHaveLength(1);
    expect(body.constraints).toHaveLength(2);
  });

  it("retries once on invalid JSON from GPT, then returns valid result", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockChatCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: VALID_PROBLEM_JSON } }],
      });

    const response = await POST(makeRequest({ config: VALID_CONFIG }));
    expect(response.status).toBe(200);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 500 after two failed attempts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: '{"title": "incomplete"}' } }],
    });

    const response = await POST(makeRequest({ config: VALID_CONFIG }));
    expect(response.status).toBe(500);
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when GPT returns empty response twice", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const response = await POST(makeRequest({ config: VALID_CONFIG }));
    expect(response.status).toBe(500);
  });

  // 123-L: POST with Other + additional_instructions → OpenAI called with user's Other topic
  it("passes Other topic via additional_instructions into the OpenAI prompt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_PROBLEM_JSON } }],
    });

    const configWithOther = {
      interview_type: "leetcode",
      focus_areas: ["arrays", "other"],
      language: "python",
      difficulty: "medium",
      additional_instructions: "Other focus area: GPU shaders",
    };

    const response = await POST(makeRequest({ config: configWithOther }));
    expect(response.status).toBe(200);

    // The OpenAI call should have received a prompt containing the user's Other topic
    expect(mockChatCreate).toHaveBeenCalledOnce();
    const callArgs = mockChatCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string; content: string }) => m.role === "user"
    );
    expect(userMessage.content).toContain("Other focus area: GPU shaders");
    // The raw "other" sentinel should NOT appear in the focus-areas topics line
    expect(userMessage.content).not.toMatch(/topics:.*other/);
  });
});
