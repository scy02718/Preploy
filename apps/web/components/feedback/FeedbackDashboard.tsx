"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download, Sparkles } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { ScoreCard } from "./ScoreCard";
import { StrengthsWeaknesses } from "./StrengthsWeaknesses";
import { AnswerBreakdown } from "./AnswerBreakdown";
import { CodeQualityCard } from "./CodeQualityCard";
import { TimelineView, type TimelineEvent } from "./TimelineView";
import { GazePresenceCard } from "./GazePresenceCard";
import { PreparedVsSpokenCard, type DriftAnalysis } from "./PreparedVsSpokenCard";
import type { GazeDistribution, GazeTimelineBucket } from "@/lib/gaze-metrics";

interface AnswerAnalysis {
  question: string;
  answer_summary: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

interface FeedbackData {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  answerAnalyses: AnswerAnalysis[];
  codeQualityScore?: number;
  explanationQualityScore?: number;
  timelineAnalysis?: TimelineEvent[];
  gazeConsistencyScore?: number | null;
  gazeDistribution?: GazeDistribution | null;
  gazeCoverage?: number | null;
  gazeTimeline?: GazeTimelineBucket[] | null;
  driftAnalysis?: DriftAnalysis | null;
}

interface FeedbackDashboardProps {
  feedback: FeedbackData;
  sessionId: string;
  sessionType?: "behavioral" | "technical";
}

export function FeedbackDashboard({
  feedback,
  sessionType = "behavioral",
}: FeedbackDashboardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { plan } = usePlan();
  const isTechnical = sessionType === "technical";
  const setupLink = isTechnical
    ? "/interview/technical/setup"
    : "/interview/behavioral/setup";

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      // Dynamic import to avoid loading PDF library on page load (~500KB)
      const { pdf } = await import("@react-pdf/renderer");
      const { FeedbackPDF } = await import("./FeedbackPDF");

      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const blob = await pdf(
        <FeedbackPDF feedback={feedback} sessionType={sessionType} date={date} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `feedback-${sessionType}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [feedback, sessionType]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Interview Feedback</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <div className="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-4 w-4" />
                Export PDF
              </>
            )}
          </Button>
          <Link href={setupLink}>
            <Button variant="outline">Start New Interview</Button>
          </Link>
        </div>
      </div>

      {/* Pro analysis banner — visible reinforcement that a Pro user's
          feedback ran through the deeper model (shipped in #177). Gated
          on the current user's plan via usePlan(); a user who upgraded
          AFTER generating this feedback will still see the banner even
          though this specific feedback was free-tier — accepted edge case
          until tier is persisted on the feedback row. */}
      {plan === "pro" && (
        <div
          className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
          data-testid="pro-analysis-banner"
        >
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-primary">Pro analysis</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re getting our deeper feedback mode — extended
              per-answer critique, filler-word stats, phrase coaching, and
              an &ldquo;if you were me&rdquo; rewrite on every answer.
            </p>
          </div>
        </div>
      )}

      {/* Scores row — ScoreCard + CodeQualityCard side-by-side on desktop */}
      {isTechnical &&
      feedback.codeQualityScore != null &&
      feedback.explanationQualityScore != null ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ScoreCard score={feedback.overallScore} summary={feedback.summary} />
          <CodeQualityCard
            codeQualityScore={feedback.codeQualityScore}
            explanationQualityScore={feedback.explanationQualityScore}
          />
        </div>
      ) : (
        <ScoreCard score={feedback.overallScore} summary={feedback.summary} />
      )}

      <StrengthsWeaknesses
        strengths={feedback.strengths}
        weaknesses={feedback.weaknesses}
      />

      {/* Gaze presence card — behavioral only, when gaze tracking was active
          (gazeCoverage !== null is the reliable signal that the pipeline ran) */}
      {!isTechnical && feedback.gazeCoverage != null && (
        <GazePresenceCard
          gazeConsistencyScore={feedback.gazeConsistencyScore ?? null}
          gazeDistribution={feedback.gazeDistribution ?? null}
          gazeCoverage={feedback.gazeCoverage}
          gazeTimeline={feedback.gazeTimeline ?? null}
        />
      )}

      {/* Prepared vs. Spoken drift card — behavioral only, when session was
          linked to a STAR story (drift_analysis non-null) */}
      {!isTechnical && feedback.driftAnalysis != null && (
        <PreparedVsSpokenCard driftAnalysis={feedback.driftAnalysis} />
      )}

      {/* Breakdown + Timeline side-by-side for technical, full-width for behavioral */}
      {isTechnical &&
      feedback.timelineAnalysis &&
      feedback.timelineAnalysis.length > 0 &&
      feedback.answerAnalyses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnswerBreakdown
            analyses={feedback.answerAnalyses}
            title="Performance Analysis"
          />
          <TimelineView events={feedback.timelineAnalysis} />
        </div>
      ) : (
        <>
          {feedback.answerAnalyses.length > 0 && (
            <AnswerBreakdown
              analyses={feedback.answerAnalyses}
              title={isTechnical ? "Performance Analysis" : "Per-Answer Breakdown"}
            />
          )}
          {isTechnical &&
            feedback.timelineAnalysis &&
            feedback.timelineAnalysis.length > 0 && (
              <TimelineView events={feedback.timelineAnalysis} />
            )}
        </>
      )}

      <div className="flex gap-3 pt-4">
        <Link href={setupLink}>
          <Button>Start New Interview</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
