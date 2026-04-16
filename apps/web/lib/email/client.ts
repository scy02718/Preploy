/**
 * Lazy-init Resend client. Follows the SDK-lazy-init pattern from
 * apps/web/CLAUDE.md — the client is only constructed on first use so
 * `next build` doesn't crash when RESEND_API_KEY is missing.
 *
 * When the env var is unset, `getResendClient()` returns null and callers
 * skip sending (with a warn log). This keeps dev + CI working without a
 * real Resend account.
 */
import { Resend } from "resend";
import { logger } from "@/lib/logger";

let cached: Resend | null | undefined;
let warnedMissing = false;

export function getResendClient(): Resend | null {
  if (cached !== undefined) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedMissing) {
      warnedMissing = true;
      logger.warn(
        "RESEND_API_KEY not set — transactional emails will be skipped. " +
          "This is fine for local dev but NOT for production."
      );
    }
    cached = null;
    return null;
  }

  cached = new Resend(apiKey);
  return cached;
}
