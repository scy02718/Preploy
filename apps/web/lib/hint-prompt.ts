/**
 * Hint prompt builder for technical interview coaching.
 *
 * Builds the system + user messages for a per-session LLM hint request.
 * Pure function — no side effects, no I/O.
 */

export interface HintPromptInput {
  /** Problem title shown to the candidate */
  problemTitle: string;
  /** Full problem description */
  problemDescription: string;
  /** Current code in the editor */
  code: string;
  /** Programming language label (e.g. "python", "javascript") */
  language: string;
  /** Hints already given this session, in order */
  priorHints: string[];
}

export interface HintPromptResult {
  systemPrompt: string;
  userMessage: string;
}

export const HINT_SYSTEM_PROMPT =
  "You are a senior software engineer coaching a candidate through a technical interview. " +
  "Your role is strictly coaching — you must NEVER write code for the candidate, never provide " +
  "near-complete implementations, and never include inline code fences or code blocks in your response. " +
  "Hints should guide thinking, not give answers. Escalate specificity across hints: hint 1 is " +
  "conceptual, hint 2 names a relevant pattern or data structure, hint 3 points at the specific " +
  "step the candidate is stuck on — still without code.";

export function buildHintPrompt({
  problemTitle,
  problemDescription,
  code,
  language,
  priorHints,
}: HintPromptInput): HintPromptResult {
  const priorHintsSection =
    priorHints.length > 0
      ? "\n\nPrior hints given:\n" +
        priorHints.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "";

  const userMessage =
    `Problem: ${problemTitle}\n\n` +
    `Description: ${problemDescription}\n\n` +
    `Current code (${language}):\n${code}` +
    priorHintsSection +
    "\n\nPlease provide the next coaching hint.";

  return {
    systemPrompt: HINT_SYSTEM_PROMPT,
    userMessage,
  };
}
