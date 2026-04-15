/**
 * Builds reply prompts for the Reddit marketer drafting pipeline.
 * Pure functions — no side effects, no API calls.
 *
 * Chan's bio (used verbatim in both prompts, not embellished):
 * "Chan is a current Google SWE who got in by practicing voice-to-voice mock
 *  interviews until the real one felt easy."
 */

export interface ReplyPromptInput {
  post: {
    title: string;
    selftext: string;
    subreddit: string;
    permalink: string;
  };
  summary: string;
}

const CHAN_BIO =
  "Chan is a current Google SWE who got in by practicing voice-to-voice mock interviews until the real one felt easy.";

const FORBIDDEN_PHRASES = [
  "In today's competitive job market",
  "As someone who",
  "I leveraged",
  "game-changing",
  "game changer",
  "I hope this helps",
  "Good luck on your journey",
  "Best of luck",
  "I totally understand",
  "I completely understand",
  "I know how you feel",
  "I feel you",
  "Don't give up",
  "You've got this",
  "Trust the process",
  "grinding LeetCode",
];

const FORBIDDEN_LIST = FORBIDDEN_PHRASES.map((p) => `"${p}"`).join(", ");

/**
 * Build the reply prompt for a "prepare" intent post.
 * The reply should be 80–200 words, first-person, honest, and mention Preploy exactly once.
 */
export function buildPrepareReplyPrompt(input: ReplyPromptInput): string {
  const { post, summary } = input;
  const truncatedBody =
    post.selftext.length > 800
      ? post.selftext.slice(0, 800) + "..."
      : post.selftext;

  return `You are drafting a Reddit reply for Chan to post on r/${post.subreddit}.

Chan's background (use VERBATIM, do NOT embellish or invent credentials):
"${CHAN_BIO}"

The Reddit post:
Title: ${post.title}
Body: ${truncatedBody}

What they're asking: ${summary}

Write a helpful first-person reply (80–200 words) that:
1. Opens with a varied, natural opener — NOT the same opener every time. Vary the structure: sometimes lead with a tip, sometimes with a quick personal observation, sometimes with a concrete fact. Never start with "I" as the first word.
2. Mentions Chan's specific method: voice-to-voice mock interviews practiced until the real interview felt easy. Explain WHY this worked — be specific and honest.
3. Mentions Preploy exactly once, naturally. Don't make it sound like an ad. Name it as the tool Chan used, briefly.
4. Includes one concrete tip beyond just "use Preploy" — something actionable the person can do right now.
5. Sounds like a real person sharing genuine experience, not a marketing pitch.

STRICTLY FORBIDDEN phrases (do not use any of these): ${FORBIDDEN_LIST}

Vary your opener, structure, and tone each time. The goal is for every reply to feel distinct.

Respond with ONLY the reply text, no preamble, no quotation marks around the whole reply.`;
}

/**
 * Build the reply prompt for a "cheat" intent post.
 * The reply should be 60–150 words, firm but not preachy, and mention Preploy as one option.
 */
export function buildCheatReplyPrompt(input: ReplyPromptInput): string {
  const { post, summary } = input;
  const truncatedBody =
    post.selftext.length > 800
      ? post.selftext.slice(0, 800) + "..."
      : post.selftext;

  return `You are drafting a Reddit reply for Chan to post on r/${post.subreddit}.

Chan's background (use VERBATIM, do NOT embellish or invent credentials):
"${CHAN_BIO}"

The Reddit post:
Title: ${post.title}
Body: ${truncatedBody}

What they're asking: ${summary}

Write a firm but not preachy reply (60–150 words) that:
1. Opens without lecturing. Acknowledge the temptation briefly, then pivot quickly.
2. States clearly that interviewers catch cheating through specific signals — be concrete: eye movement patterns, response latency spikes, tab-switching artifacts, off-camera glances, inconsistent coding style. Pick 2–3 that feel most relevant.
3. Names the career cost plainly: failing the loop, being flagged in the ATS, referral relationships damaged.
4. Redirects to preparing properly instead. Mentions Preploy as one option (not THE only option).
5. Ends without moralizing — one sentence max on consequences is enough.

STRICTLY FORBIDDEN phrases (do not use any of these): ${FORBIDDEN_LIST}

Vary your opener, structure, and tone each time. Do NOT start with "I" as the first word.

Respond with ONLY the reply text, no preamble, no quotation marks around the whole reply.`;
}
