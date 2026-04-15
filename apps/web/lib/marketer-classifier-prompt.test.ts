import { describe, it, expect } from "vitest";
import { buildClassifierPrompt } from "./marketer-classifier-prompt";

describe("buildClassifierPrompt", () => {
  const preparePost = {
    title: "How should I prepare for my Google SWE interview next month?",
    body: "I have a Google interview in 4 weeks. I've been doing LeetCode but I'm not sure if I'm practicing effectively. Any advice on mock interviews or system design?",
    subreddit: "cscareerquestions",
  };

  const cheatPost = {
    title: "Best AI tools to use during a live coding interview?",
    body: "I have an interview tomorrow and wondering if anyone has experience using AI tools discreetly during the technical round. Something that can suggest code without the interviewer noticing?",
    subreddit: "cscareerquestions",
  };

  const irrelevantPost = {
    title: "Got rejected from Amazon after 5 rounds",
    body: "Just got the rejection email. 5 rounds of interviews, passed the technical but failed bar raiser. I'm devastated.",
    subreddit: "cscareerquestions",
  };

  it("includes the post title in the prompt", () => {
    const prompt = buildClassifierPrompt(preparePost);
    expect(prompt).toContain(preparePost.title);
  });

  it("includes the post body in the prompt", () => {
    const prompt = buildClassifierPrompt(preparePost);
    expect(prompt).toContain("mock interviews");
  });

  it("includes the subreddit in the prompt", () => {
    const prompt = buildClassifierPrompt(preparePost);
    expect(prompt).toContain("r/cscareerquestions");
  });

  it("includes all three classification categories in the prompt", () => {
    const prompt = buildClassifierPrompt(preparePost);
    expect(prompt).toContain('"prepare"');
    expect(prompt).toContain('"cheat"');
    expect(prompt).toContain('"irrelevant"');
  });

  it("instructs to return JSON with classification and summary fields", () => {
    const prompt = buildClassifierPrompt(preparePost);
    expect(prompt).toContain("classification");
    expect(prompt).toContain("summary");
    expect(prompt).toContain("JSON");
  });

  it("truncates very long body text at 1500 characters", () => {
    const longBody = "a".repeat(2000);
    const prompt = buildClassifierPrompt({ ...preparePost, body: longBody });
    expect(prompt).toContain("...");
    // The full 2000-char body should not appear
    expect(prompt).not.toContain(longBody);
  });

  it("produces different prompts for different posts", () => {
    const prompt1 = buildClassifierPrompt(preparePost);
    const prompt2 = buildClassifierPrompt(cheatPost);
    const prompt3 = buildClassifierPrompt(irrelevantPost);
    expect(prompt1).not.toEqual(prompt2);
    expect(prompt2).not.toEqual(prompt3);
  });

  it("describes cheat signals in classification criteria", () => {
    const prompt = buildClassifierPrompt(cheatPost);
    expect(prompt).toContain("cheat");
    // Prompt should describe what cheat means — includes something about unauthorized
    expect(prompt.toLowerCase()).toMatch(/(cheat|unauthorized|unfairly)/);
  });

  it("works with empty body", () => {
    const prompt = buildClassifierPrompt({ ...preparePost, body: "" });
    expect(prompt).toContain(preparePost.title);
    // Should not throw
  });

  it("includes the subreddit for a different subreddit", () => {
    const prompt = buildClassifierPrompt({ ...cheatPost, subreddit: "leetcode" });
    expect(prompt).toContain("r/leetcode");
  });
});
