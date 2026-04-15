import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Logger } from "pino";
import { fetchSubredditPosts } from "./reddit";

// Fake pino logger
const fakeLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const now = Date.now();
const freshPost = {
  kind: "t3",
  data: {
    id: "post1",
    subreddit: "cscareerquestions",
    title: "How do I prepare?",
    selftext: "I have an interview coming up.",
    permalink: "/r/cscareerquestions/comments/post1/",
    created_utc: Math.floor((now - 24 * 60 * 60 * 1000) / 1000), // 24h ago (within 48h window)
    is_self: true,
  },
};

const stalePost = {
  kind: "t3",
  data: {
    id: "post2",
    subreddit: "cscareerquestions",
    title: "Old post",
    selftext: "This is old.",
    permalink: "/r/cscareerquestions/comments/post2/",
    created_utc: Math.floor((now - 72 * 60 * 60 * 1000) / 1000), // 72h ago (outside 48h window)
    is_self: true,
  },
};

const linkPost = {
  kind: "t3",
  data: {
    id: "post3",
    subreddit: "cscareerquestions",
    title: "Link post",
    selftext: "",
    permalink: "/r/cscareerquestions/comments/post3/",
    created_utc: Math.floor((now - 1 * 60 * 60 * 1000) / 1000), // 1h ago
    is_self: false, // Link post — should be filtered
  },
};

function makeApiResponse(children: unknown[]) {
  return {
    data: {
      children,
    },
  };
}

describe("fetchSubredditPosts", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns fresh self posts from a 200 response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeApiResponse([freshPost]),
    } as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("post1");
    expect(posts[0].title).toBe("How do I prepare?");
  });

  it("filters out stale posts older than freshness window", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeApiResponse([freshPost, stalePost]),
    } as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("post1");
  });

  it("filters out non-self (link) posts", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeApiResponse([linkPost, freshPost]),
    } as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("post1");
  });

  it("retries once on 429 and returns posts on success", async () => {
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeApiResponse([freshPost]),
      } as Response);

    const fetchPromise = fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    await vi.advanceTimersByTimeAsync(5_001);
    const posts = await fetchPromise;

    expect(posts).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(fakeLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "cscareerquestions" }),
      expect.stringContaining("429")
    );
    vi.useRealTimers();
  });

  it("returns empty array on persistent 429 after retry", async () => {
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 429,
      } as Response);

    const fetchPromise = fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    await vi.advanceTimersByTimeAsync(5_001);
    const posts = await fetchPromise;

    expect(posts).toHaveLength(0);
    expect(fakeLog.error).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("returns empty array on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(0);
    expect(fakeLog.error).toHaveBeenCalled();
  });

  it("returns empty array on non-OK non-429 status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(0);
    expect(fakeLog.error).toHaveBeenCalled();
  });

  it("returns empty array on invalid JSON response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error("Invalid JSON"); },
    } as unknown as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(0);
    expect(fakeLog.error).toHaveBeenCalled();
  });

  it("handles empty children array gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeApiResponse([]),
    } as Response);

    const posts = await fetchSubredditPosts("cscareerquestions", 25, fakeLog);
    expect(posts).toHaveLength(0);
  });
});
