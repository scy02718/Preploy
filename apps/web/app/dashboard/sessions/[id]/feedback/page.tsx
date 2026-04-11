"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

export default function FeedbackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionType, setSessionType] = useState<
    "behavioral" | "technical"
  >("behavioral");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${params.id}/feedback`);

      if (res.status === 404) {
        // Not ready yet — keep polling
        return false;
      }

      if (res.status === 401) {
        router.replace("/login");
        return true;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load feedback");
        setIsLoading(false);
        return true;
      }

      const data = await res.json();
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
      return true;
    } catch {
      setError("Failed to connect to server");
      setIsLoading(false);
      return true;
    }
  }, [params.id, router]);

  useEffect(() => {
    // Initial fetch
    fetchFeedback().then((done) => {
      if (!done) {
        // Start polling every 3 seconds
        pollRef.current = setInterval(async () => {
          const done = await fetchFeedback();
          if (done && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, 3000);
      }
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchFeedback]);

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
            fetchFeedback();
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
