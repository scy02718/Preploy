"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FeedbackDashboard } from "@/components/feedback/FeedbackDashboard";
import type { TimelineEvent } from "@/components/feedback/TimelineView";
import type { GazeDistribution, GazeTimelineBucket } from "@/lib/gaze-metrics";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

interface DriftAnalysis {
  added: string[];
  omitted: string[];
  tightened: string[];
  loosened: string[];
}

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
  gazeConsistencyScore?: number | null;
  gazeDistribution?: GazeDistribution | null;
  gazeCoverage?: number | null;
  gazeTimeline?: GazeTimelineBucket[] | null;
  driftAnalysis?: DriftAnalysis | null;
  analysisTier?: "free" | "pro" | null;
}

const MAX_POLL_ATTEMPTS = 40; // 40 × 3s = 2 minutes max
const POLL_INTERVAL_MS = 3000;

export default function FeedbackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [sessionType, setSessionType] = useState<
    "behavioral" | "technical" | null
  >(null);
  const [persona, setPersona] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Retry nonce — bumped by the Retry button to re-arm the polling effect
  // without a full page reload (which would drop scroll position and any
  // in-progress UI state).
  const [retryNonce, setRetryNonce] = useState(0);

  // Poll for feedback — re-runs when retryNonce changes, cleans up on unmount.
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

        // Set sessionType and feedback in the same event handler so React 19
        // batches them into a single commit. This guarantees CodeQualityCard
        // and ScoreCard appear on the first paint for technical sessions
        // (no flicker from two independent fetches). sessionType starts as
        // null and the loading skeleton gates the <FeedbackDashboard /> render
        // below until both pieces of state are set in this same commit.
        setSessionType(data.type === "technical" ? "technical" : "behavioral");
        // Thread persona from config.persona — the feedback API returns the
        // full config jsonb, so config.persona is available here.
        setPersona(
          typeof data.config?.persona === "string"
            ? data.config.persona
            : undefined
        );
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
          gazeConsistencyScore: data.gazeConsistencyScore ?? undefined,
          gazeDistribution: data.gazeDistribution ?? undefined,
          gazeCoverage: data.gazeCoverage ?? undefined,
          gazeTimeline: data.gazeTimeline ?? undefined,
          driftAnalysis: data.driftAnalysis ?? undefined,
          analysisTier: data.analysisTier ?? data.analysis_tier ?? null,
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
    // Re-run when the session ID changes or when the user hits Retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, retryNonce]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
            <div className="h-9 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>

        {/* Score card skeleton */}
        <div className="rounded-lg border p-6 flex items-center gap-6">
          <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>

        {/* Strengths/Weaknesses skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border p-6 space-y-3">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
          <div className="rounded-lg border p-6 space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        </div>

        {/* Gaze card skeleton removed — not all sessions have gaze data,
            so a dedicated skeleton promises content the post-load layout may
            never render. When gaze is present the card mounts naturally; when
            it isn't, nothing was promised. */}

        {/* Breakdown skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-64 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-10 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Generating feedback… This may take a few seconds.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="mb-4 text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsLoading(true);
            setRetryNonce((n) => n + 1);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (!feedback || !sessionType) return null;

  return (
    <>
      {/* Sticky back-link so the path home is always visible, not buried
          below a long per-answer breakdown.

          Dashboard layout wraps this page in `<div className="flex-1
          overflow-auto p-6">`. Two separate offsets have to line up:

          - `-mt-6 -mx-6` pulls the bar OUT of the `p-6` so it spans the
            scroll container edge-to-edge (and not inset by 24px).
          - `-top-6` sets the STICKY anchor. The CSS spec measures sticky
            `top` from the scroll container's *padding* edge, not the
            border edge. With `p-6` on the container, `top: 0` would pin
            the bar 24px DOWN from the visible top. `top: -1.5rem` (i.e.
            `-top-6`) backs that offset out so the bar pins flush against
            the header. Without this, the bar renders 24px below the
            header — which is the "ample space above" the user reported. */}
      <div className="sticky -top-6 z-20 -mx-6 -mt-6 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      </div>
      <FeedbackDashboard
        feedback={feedback}
        sessionId={params.id}
        sessionType={sessionType}
        persona={persona}
      />
    </>
  );
}
