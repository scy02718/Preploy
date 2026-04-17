import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";

const FEEDBACK_RECIPIENT = "preploy.dev@gmail.com";

const feedbackSchema = z.object({
  type: z.enum(["Bug", "Feature Request", "Other"]).default("Other"),
  message: z.string().trim().min(5).max(5000),
  page: z.string().max(500).default("unknown"),
});

/**
 * POST /api/feedback — submit user feedback from the in-app dialog.
 * Validates input with Zod, then sends an email to preploy.dev@gmail.com
 * via Resend. The feedback dialog is now hosted in the Sidebar component.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const log = createRequestLogger({
    route: "POST /api/feedback",
    userId: session.user.id,
  });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(rawBody);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => i.message)
      .join("; ");
    return NextResponse.json({ error: summary }, { status: 400 });
  }

  const { type, message, page } = parsed.data;
  const userEmail = session.user.email ?? "unknown";
  const userName = session.user.name ?? "Unknown user";

  const subject = `[Preploy Feedback] ${type} from ${userName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; padding: 16px;">
      <h2 style="margin: 0 0 12px;">New feedback: ${type}</h2>
      <p style="margin: 0 0 4px;"><strong>From:</strong> ${userName} (${userEmail})</p>
      <p style="margin: 0 0 4px;"><strong>Page:</strong> ${page}</p>
      <p style="margin: 0 0 4px;"><strong>Plan:</strong> ${session.user.id ? "authenticated" : "unknown"}</p>
      <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>
  `;

  try {
    await sendEmail({ to: FEEDBACK_RECIPIENT, subject, html });
    log.info({ type, page }, "feedback submitted");
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, "feedback email failed");
    return NextResponse.json(
      { error: "Failed to send feedback. Please try again." },
      { status: 500 }
    );
  }
}
