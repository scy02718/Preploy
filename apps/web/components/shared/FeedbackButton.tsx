"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pages where the feedback button should NOT render. */
const HIDDEN_PATHS = [
  "/",
  "/login",
  "/pricing",
  "/privacy",
  "/terms",
  // Hide during active interview sessions — the floating button overlaps
  // the "End Session" controls at the bottom of the screen.
  "/interview/behavioral/session",
  "/interview/technical/session",
];

const FEEDBACK_TYPES = ["Bug", "Feature Request", "Other"] as const;

/**
 * Floating feedback button + in-page popup form. On authenticated pages,
 * renders a small pill in the bottom-right corner. Clicking opens a compact
 * form where the user selects a type, writes a message, and submits. The
 * submission POSTs to /api/feedback which sends an email to
 * preploy.dev@gmail.com via Resend.
 */
export function FeedbackButton() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<(typeof FEEDBACK_TYPES)[number]>("Bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide on public pages, during interviews, and when not signed in.
  if (HIDDEN_PATHS.includes(pathname) || !session?.user) {
    return null;
  }

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 5) {
      setError("Please write at least 5 characters.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim(), page: pathname }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setMessage("");
          setType("Bug");
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send. Please try again.");
      }
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    // Keep the message in case they want to reopen
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-md backdrop-blur transition-colors hover:text-foreground hover:shadow-lg cursor-pointer"
          data-testid="feedback-button"
          aria-label="Send feedback"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      {/* Popup form */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Send Feedback</h3>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close feedback form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Thanks! Your feedback has been sent.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Type selector */}
              <div className="flex gap-1.5">
                {FEEDBACK_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      type === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue or idea..."
                rows={4}
                maxLength={5000}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              {/* Error */}
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !message.trim()}
                size="sm"
                className="w-full gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Sending..." : "Send Feedback"}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Sent to the Preploy team as {session.user.email}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
