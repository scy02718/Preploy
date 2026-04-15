import { describe, it, expect } from "vitest";
import { buildPrepareReplyPrompt, buildCheatReplyPrompt } from "./marketer-reply-prompt";

const CHAN_BIO =
  "Chan is a current Google SWE who got in by practicing voice-to-voice mock interviews until the real one felt easy.";

const post1 = {
  title: "How do I prepare for a Google SWE interview in 3 weeks?",
  selftext: "I have a final round at Google coming up and I'm panicking. I've been grinding LeetCode but not sure if it's enough.",
  subreddit: "cscareerquestions",
  permalink: "/r/cscareerquestions/comments/abc123/how_do_i_prepare/",
};

const post2 = {
  title: "Best way to practice behavioral interviews?",
  selftext: "Amazon loop is coming up. I know I need to practice STAR stories but I keep blanking in the moment.",
  subreddit: "interviews",
  permalink: "/r/interviews/comments/def456/best_way_to_practice/",
};

const post3 = {
  title: "Tips for system design interviews?",
  selftext: "Senior SWE role at Meta. System design has always been my weak point. How do I improve quickly?",
  subreddit: "leetcode",
  permalink: "/r/leetcode/comments/ghi789/tips_for_system_design/",
};

const cheatPost1 = {
  title: "Using AI during a live coding interview — will they catch me?",
  selftext: "Wondering if anyone has used Copilot or ChatGPT during a live coding round without the interviewer noticing.",
  subreddit: "cscareerquestions",
  permalink: "/r/cscareerquestions/comments/xyz123/using_ai_during/",
};

const cheatPost2 = {
  title: "How do companies detect cheating in technical interviews?",
  selftext: "Not planning to cheat, just curious about what signals interviewers look for.",
  subreddit: "cscareerquestions",
  permalink: "/r/cscareerquestions/comments/uvw456/how_detect/",
};

describe("buildPrepareReplyPrompt", () => {
  it("includes Chan's bio verbatim", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "How to prepare for Google SWE interview" });
    expect(prompt).toContain(CHAN_BIO);
  });

  it("includes the post title", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "Google prep advice needed" });
    expect(prompt).toContain(post1.title);
  });

  it("includes the subreddit", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "Google prep advice needed" });
    expect(prompt).toContain(post1.subreddit);
  });

  it("includes the summary", () => {
    const summary = "Person wants Google prep tips";
    const prompt = buildPrepareReplyPrompt({ post: post1, summary });
    expect(prompt).toContain(summary);
  });

  it("instructs to mention Preploy exactly once", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "Google prep" });
    expect(prompt).toContain("exactly once");
  });

  it("includes word count guidance (80-200 words)", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "Google prep" });
    expect(prompt).toContain("80");
    expect(prompt).toContain("200");
  });

  it("forbids template phrases", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "Google prep" });
    expect(prompt).toContain("In today's competitive job market");
    expect(prompt).toContain("game-changing");
  });

  it("produces different prompts for different posts", () => {
    const summary = "Interview prep question";
    const prompt1 = buildPrepareReplyPrompt({ post: post1, summary });
    const prompt2 = buildPrepareReplyPrompt({ post: post2, summary });
    const prompt3 = buildPrepareReplyPrompt({ post: post3, summary });
    expect(prompt1).not.toEqual(prompt2);
    expect(prompt2).not.toEqual(prompt3);
    expect(prompt1).not.toEqual(prompt3);
  });

  it("truncates very long selftext at 800 characters", () => {
    const longSelftext = "x".repeat(1500);
    const prompt = buildPrepareReplyPrompt({
      post: { ...post1, selftext: longSelftext },
      summary: "test",
    });
    expect(prompt).toContain("...");
    expect(prompt).not.toContain(longSelftext);
  });

  it("instructs NOT to embellish or invent credentials", () => {
    const prompt = buildPrepareReplyPrompt({ post: post1, summary: "test" });
    expect(prompt).toContain("NOT embellish");
  });
});

describe("buildCheatReplyPrompt", () => {
  it("includes Chan's bio verbatim", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "Asking about AI tools during interview" });
    expect(prompt).toContain(CHAN_BIO);
  });

  it("includes the post title", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt).toContain(cheatPost1.title);
  });

  it("instructs to mention specific cheat detection signals", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt.toLowerCase()).toMatch(/(eye movement|latency|tab.switching|off.camera)/);
  });

  it("includes word count guidance (60-150 words)", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt).toContain("60");
    expect(prompt).toContain("150");
  });

  it("forbids template phrases", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt).toContain("In today's competitive job market");
    expect(prompt).toContain("game-changing");
  });

  it("produces different prompts for different posts", () => {
    const summary = "Cheat related question";
    const prompt1 = buildCheatReplyPrompt({ post: cheatPost1, summary });
    const prompt2 = buildCheatReplyPrompt({ post: cheatPost2, summary });
    expect(prompt1).not.toEqual(prompt2);
  });

  it("instructs to mention Preploy as one option (not the only option)", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt).toContain("Preploy");
    expect(prompt.toLowerCase()).toContain("one option");
  });

  it("instructs NOT to embellish or invent credentials", () => {
    const prompt = buildCheatReplyPrompt({ post: cheatPost1, summary: "test" });
    expect(prompt).toContain("NOT embellish");
  });
});
