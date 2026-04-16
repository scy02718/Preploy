import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";

const FEEDBACK_RECIPIENT = "support@preploy.tech";

/**
 * POST /api/feedback — submit user feedback from the in-app popup.
 * Sends an email to the product owner via Resend.
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

  let body: { type?: string; message?: string; page?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type ?? "Other";
  const message = body.message?.trim();
  const page = body.page ?? "unknown";

  if (!message || message.length < 5) {
    return NextResponse.json(
      { error: "Message must be at least 5 characters" },
      { status: 400 }
    );
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message must be under 5000 characters" },
      { status: 400 }
    );
  }

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
