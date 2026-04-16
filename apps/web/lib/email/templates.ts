/**
 * Transactional email templates. Plain HTML strings — no React Email
 * dependency. Keeps the footprint small and the templates easy to grep.
 *
 * Each function returns { subject, html } ready for `sendEmail()`.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://preploy.tech";

const FOOTER = `
<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
<p style="font-size: 12px; color: #6b7280;">
  You're receiving this because you have a Preploy account.<br/>
  <a href="mailto:support@preploy.tech" style="color: #6b7280;">Contact support</a>
</p>
`;

export function welcomeEmail(name: string | null) {
  const greeting = name ? `Hi ${name}` : "Welcome";
  return {
    subject: "Welcome to Preploy — let's ace your next interview",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 24px; font-weight: 700;">${greeting}, welcome to Preploy!</h1>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          You now have access to AI-powered mock interviews — both behavioral
          and technical — with scored feedback on every session.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Your free plan includes <strong>3 mock interviews per month</strong>.
          Start your first one now — it takes about 5 minutes.
        </p>
        <a href="${BASE_URL}/dashboard"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Go to Dashboard
        </a>
        ${FOOTER}
      </div>
    `,
  };
}

export function feedbackReadyEmail(
  name: string | null,
  sessionId: string,
  score: number | null
) {
  const greeting = name ? `Hi ${name}` : "Hi there";
  const scoreText = score !== null ? ` You scored <strong>${score.toFixed(1)}/10</strong>.` : "";
  return {
    subject: "Your interview feedback is ready",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 24px; font-weight: 700;">Feedback ready!</h1>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          ${greeting}, your mock interview has been scored.${scoreText}
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Review your strengths, areas for improvement, and detailed
          answer-by-answer analysis:
        </p>
        <a href="${BASE_URL}/dashboard/sessions/${sessionId}/feedback"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Feedback
        </a>
        ${FOOTER}
      </div>
    `,
  };
}

export function freeTierLimitEmail(name: string | null, used: number, limit: number) {
  const greeting = name ? `Hi ${name}` : "Hi there";
  return {
    subject: `You've used ${used} of ${limit} free interviews this month`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 24px; font-weight: 700;">You're making great progress!</h1>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          ${greeting}, you've completed <strong>${used} of ${limit}</strong>
          free mock interviews this month. That's dedication.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Want to keep practicing? Upgrade to Pro for
          <strong>40 sessions per month</strong> — or save 33% with the
          annual plan.
        </p>
        <a href="${BASE_URL}/profile"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Upgrade to Pro
        </a>
        ${FOOTER}
      </div>
    `,
  };
}
