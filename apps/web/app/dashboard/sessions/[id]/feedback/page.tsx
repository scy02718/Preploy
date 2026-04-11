"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FeedbackDashboard } from "@/components/feedback/FeedbackDashboard";
import type { TimelineEvent } from "@/components/feedback/TimelineView";

interface FeedbackData {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  answerAnalyses: {
    question: string;
    answer_summary: string;
    score: number;
    feedback: string;
    suggestions: string[];
  }[];
  codeQualityScore?: number;
  explanationQualityScore?: number;
  timelineAnalysis?: TimelineEvent[];
}

const MAX_POLL_ATTEMPTS = 40; // 40 × 3s = 2 minutes max
const POLL_INTERVAL_MS = 3000;

export default function FeedbackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionType, setSessionType] = useState<
    "behavioral" | "technical"
  >("behavioral");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch session type once
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.type === "technical") {
            setSessionType("technical");
          }
        }
      } catch {
        // Non-critical — default to behavioral
      }
    }
    fetchSession();
  }, [params.id]);

  // Poll for feedback — runs once on mount, cleans up on unmount.
  // All mutable state accessed via refs to avoid re-triggering the effect.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollCount = 0;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/sessions/${params.id}/feedback`);
        if (cancelled) return;

        if (res.status === 404) {
          pollCount += 1;
          if (pollCount >= MAX_POLL_ATTEMPTS) {
            setError(
              "Feedback generation is taking too long. Please try refreshing the page."
            );
            setIsLoading(false);
            return;
          }
          // Schedule next poll
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to load feedback");
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setFeedback({
          overallScore: data.overallScore ?? data.overall_score ?? 0,
          summary: data.summary ?? "",
          strengths: data.strengths ?? [],
          weaknesses: data.weaknesses ?? [],
          answerAnalyses: data.answerAnalyses ?? data.answer_analyses ?? [],
          codeQualityScore:
            data.codeQualityScore ?? data.code_quality_score ?? undefined,
          explanationQualityScore:
            data.explanationQualityScore ??
            data.explanation_quality_score ??
            undefined,
          timelineAnalysis:
            data.timelineAnalysis ?? data.timeline_analysis ?? undefined,
        });
        setIsLoading(false);
        // Done — no more polling
      } catch {
        if (cancelled) return;
        setError("Failed to connect to server");
        setIsLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
    // Only re-run if the session ID changes (page navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Generating feedback... This may take a few seconds.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="mb-4 text-destructive">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            // Re-mount the effect by forcing a state change —
            // but since params.id hasn't changed, we manually re-poll
            window.location.reload();
          }}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!feedback) return null;

  return (
    <FeedbackDashboard
      feedback={feedback}
      sessionId={params.id}
      sessionType={sessionType}
    />
  );
}
