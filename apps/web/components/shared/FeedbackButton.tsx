"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEEDBACK_TYPES = ["Bug", "Feature Request", "Other"] as const;

/**
 * FeedbackDialog — controlled modal for submitting in-app feedback.
 *
 * Architecture (post-#111 refactor):
 *   - The floating trigger button has been removed. The Sidebar now owns
 *     the trigger (a nav-style "Feedback" button below the nav divider).
 *   - This component is purely controlled: it renders nothing when
 *     `open` is false, and calls `onClose` when the user closes or
 *     successfully submits.
 *   - Submits to POST /api/feedback which sends an email to
 *     preploy.dev@gmail.com via Resend.
 */
export function FeedbackDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [type, setType] = useState<(typeof FEEDBACK_TYPES)[number]>("Bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
          onClose();
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
    setError(null);
    onClose();
  };

  return (
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
        <div className="p-6 text-center" data-testid="feedback-success">
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
            data-testid="feedback-textarea"
          />

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive" data-testid="feedback-error">{error}</p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || message.trim().length < 5}
            size="sm"
            className="w-full gap-1.5"
            data-testid="feedback-send"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? "Sending..." : "Send Feedback"}
          </Button>

          {session?.user?.email && (
            <p className="text-[10px] text-muted-foreground text-center">
              Sent to the Preploy team as {session.user.email}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Default export for any remaining consumers (backwards compat shim)
export default FeedbackDialog;
