/**
 * Builds the classification prompt for a Reddit post.
 * Returns a prompt string that asks the LLM to classify intent and extract a summary.
 * Pure function — no side effects, no API calls.
 */

export interface ClassifierInput {
  title: string;
  body: string;
  subreddit: string;
}

export interface ClassificationResult {
  classification: "prepare" | "cheat" | "irrelevant";
  summary: string;
}

/**
 * Build the classification prompt for a Reddit post.
 * The LLM must respond with valid JSON matching ClassificationResult.
 */
export function buildClassifierPrompt(input: ClassifierInput): string {
  const { title, body, subreddit } = input;

  const truncatedBody = body.length > 1500 ? body.slice(0, 1500) + "..." : body;

  return `You are classifying Reddit posts to determine whether they are relevant to interview preparation marketing.

Subreddit: r/${subreddit}
Post title: ${title}
Post body: ${truncatedBody}

Classify this post into exactly one of these three categories:

- "prepare": The person genuinely wants to prepare for interviews the right way. They're asking for study strategies, practice resources, mock interview advice, tips on improving their skills, or seeking honest feedback on their preparation approach. Include posts where the person is anxious about upcoming interviews and looking for guidance.

- "cheat": The person is looking for ways to cheat, use AI during a live interview without the interviewer knowing, look up answers in real time, use unauthorized tools, or circumvent the interview process unfairly. This includes posts asking about "AI assistance during interview," "undetected tools," "how do companies catch cheating," or similar.

- "irrelevant": The post does not clearly fit either "prepare" or "cheat." This includes job postings, salary discussions, rants, success/failure stories without a question, or off-topic content.

Also extract a one-line summary (under 100 characters) describing what the person is specifically asking.

Respond with ONLY valid JSON in this exact format, nothing else:
{"classification": "prepare" | "cheat" | "irrelevant", "summary": "<one line summary>"}`;
}
