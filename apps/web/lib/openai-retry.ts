/**
 * Shared retry helper for OpenAI calls that parse + validate JSON responses.
 *
 * Retries **once** on a malformed response (empty content, JSON parse error,
 * or schema validation error) using the same prompt — mirroring the pattern
 * in apps/api/app/services/{feedback_generator,code_analyzer}.py.
 *
 * On the first failed attempt this emits a structured Pino warning:
 *   log.warn({ attempt: 1, service, reason }, "GPT response malformed, retrying")
 * where reason ∈ "empty" | "invalid_json" | "schema_mismatch".
 *
 * On the second failed attempt the underlying `OpenAIRetryError` is re-thrown.
 */

import type pino from "pino";

export type OpenAIRetryReason = "empty" | "invalid_json" | "schema_mismatch";

export class OpenAIRetryError extends Error {
  reason: OpenAIRetryReason;
  cause?: unknown;

  constructor(reason: OpenAIRetryReason, cause?: unknown) {
    super(`OpenAI response malformed: ${reason}`);
    this.name = "OpenAIRetryError";
    this.reason = reason;
    this.cause = cause;
  }
}

/**
 * Minimal shape of an OpenAI chat completion response that this helper needs.
 * Declared structurally so callers don't have to import the OpenAI SDK types.
 */
export interface OpenAIChatLikeResponse {
  choices: Array<{ message: { content: string | null } }>;
}

export interface WithOpenAIRetryOptions {
  service: string;
  log: pino.Logger;
}

/**
 * Run an OpenAI call + parse + validate pipeline with one retry on malformed
 * responses.
 *
 * @param call               Thunk that performs the OpenAI chat completion.
 * @param parseAndValidate   Pure function that parses the raw string content
 *                           and returns the validated `T`. MUST throw an
 *                           `OpenAIRetryError("invalid_json")` on JSON parse
 *                           failure and `OpenAIRetryError("schema_mismatch")`
 *                           on schema validation failure. Any other thrown
 *                           error propagates immediately without a retry.
 * @param opts               `{ service, log }` for the structured warning.
 */
export async function withOpenAIRetry<T>(
  call: () => Promise<OpenAIChatLikeResponse>,
  parseAndValidate: (raw: string) => T,
  opts: WithOpenAIRetryOptions,
): Promise<T> {
  const { service, log } = opts;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await call();
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new OpenAIRetryError("empty");
      }
      return parseAndValidate(content);
    } catch (err) {
      if (!(err instanceof OpenAIRetryError)) {
        // Non-retry-error: propagate immediately, do not retry.
        throw err;
      }
      if (attempt === 0) {
        log.warn(
          { attempt: 1, service, reason: err.reason },
          "GPT response malformed, retrying",
        );
        continue;
      }
      throw err;
    }
  }

  // Defensive: the loop always returns or throws above.
  throw new OpenAIRetryError("empty");
}
