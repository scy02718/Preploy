"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquare } from "lucide-react";

/** Public pages where the feedback button should NOT render. */
const PUBLIC_PATHS = ["/", "/login", "/pricing", "/privacy", "/terms"];

/**
 * Floating feedback button — renders in the bottom-right corner on all
 * authenticated pages. Opens a mailto link to preploy.dev@gmail.com with
 * a pre-filled subject and body including user context (email, current
 * page, plan) so every report arrives with enough info to reproduce.
 */
export function FeedbackButton() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide on public pages and when not signed in.
  if (PUBLIC_PATHS.includes(pathname) || !session?.user) {
    return null;
  }

  const email = session.user.email ?? "unknown";
  const subject = encodeURIComponent("[Preploy Feedback] Bug / Feature Request");
  const body = encodeURIComponent(
    `Type: Bug / Feature Request / Other\n\nDescribe the issue:\n\n\n---\nUser: ${email}\nPage: ${pathname}`
  );
  const href = `mailto:preploy.dev@gmail.com?subject=${subject}&body=${body}`;

  return (
    <a
      href={href}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-md backdrop-blur transition-colors hover:text-foreground hover:shadow-lg"
      data-testid="feedback-button"
      aria-label="Send feedback"
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Feedback</span>
    </a>
  );
}
