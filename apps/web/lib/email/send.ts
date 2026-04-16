/**
 * Thin wrapper around Resend's send API. Gracefully no-ops when the
 * Resend client is unavailable (missing API key).
 */
import { getResendClient } from "./client";
import { logger } from "@/lib/logger";

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || "Preploy <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email. Fire-and-forget — callers should NOT await
 * this in the request hot path. Errors are logged but never thrown.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const resend = getResendClient();
  if (!resend) return; // dev/CI — silently skip

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    logger.info({ to: opts.to, subject: opts.subject }, "email sent");
  } catch (err) {
    // Log but don't throw — email failure should never break the user's
    // request flow.
    logger.error({ err, to: opts.to, subject: opts.subject }, "email send failed");
  }
}
