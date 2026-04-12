"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getScoreColor } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SessionOption {
  id: string;
  type: "behavioral" | "technical";
  config: Record<string, unknown>;
  createdAt: string;
  overallScore: number | null;
}

interface FeedbackData {
  overallScore: number | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  codeQualityScore?: number | null;
  explanationQualityScore?: number | null;
}

function getSessionLabel(s: SessionOption): string {
  if (s.type === "technical") {
    const it = s.config?.interview_type as string | undefined;
    if (it) return it.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return "Technical Interview";
  }
  const company = s.config?.company_name as string | undefined;
  return company || "Behavioral Interview";
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreCircle({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">--</span>;
  const color = getScoreColor(score);
  return (
    <div
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border-2 ${color.border} ${color.bg}`}
    >
      <span className={`text-sm font-bold ${color.text}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function FeedbackColumn({
  label,
  feedback,
  loading,
}: {
  label: string;
  feedback: FeedbackData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">{label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!feedback) {
    return (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a session above to view feedback.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <ScoreCircle score={feedback.overallScore} />
          <span className="text-sm text-muted-foreground">Overall Score</span>
        </div>

        {(feedback.codeQualityScore != null || feedback.explanationQualityScore != null) && (
          <div className="flex gap-4 text-sm">
            {feedback.codeQualityScore != null && (
              <div>
                <span className="text-muted-foreground">Code Quality: </span>
                <span className="font-medium">{feedback.codeQualityScore.toFixed(1)}</span>
              </div>
            )}
            {feedback.explanationQualityScore != null && (
              <div>
                <span className="text-muted-foreground">Explanation: </span>
                <span className="font-medium">{feedback.explanationQualityScore.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {feedback.summary && (
          <p className="text-sm">{feedback.summary}</p>
        )}

        <div>
          <h4 className="text-sm font-medium mb-1 text-green-600 dark:text-green-400">Strengths</h4>
          {feedback.strengths.length > 0 ? (
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {feedback.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None identified</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium mb-1 text-red-600 dark:text-red-400">Weaknesses</h4>
          {feedback.weaknesses.length > 0 ? (
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {feedback.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None identified</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionA, setSessionA] = useState<string>("");
  const [sessionB, setSessionB] = useState<string>("");
  const [feedbackA, setFeedbackA] = useState<FeedbackData | null>(null);
  const [feedbackB, setFeedbackB] = useState<FeedbackData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  // Fetch all completed sessions for the dropdown
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=50&page=1");
        if (!res.ok) return;
        const data = await res.json();
        const completed = (data.sessions as SessionOption[]).filter(
          (s) => s.overallScore != null
        );
        setSessions(completed);
      } catch {
        // silent
      } finally {
        setIsLoadingSessions(false);
      }
    }
    fetchSessions();
  }, []);

  // Fetch feedback when session A changes
  useEffect(() => {
    if (!sessionA) {
      setFeedbackA(null);
      return;
    }
    setLoadingA(true);
    fetch(`/api/sessions/${sessionA}/feedback`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setFeedbackA({
            overallScore: data.overallScore,
            summary: data.summary,
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
            codeQualityScore: data.codeQualityScore ?? null,
            explanationQualityScore: data.explanationQualityScore ?? null,
          });
        }
      })
      .finally(() => setLoadingA(false));
  }, [sessionA]);

  // Fetch feedback when session B changes
  useEffect(() => {
    if (!sessionB) {
      setFeedbackB(null);
      return;
    }
    setLoadingB(true);
    fetch(`/api/sessions/${sessionB}/feedback`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setFeedbackB({
            overallScore: data.overallScore,
            summary: data.summary,
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
            codeQualityScore: data.codeQualityScore ?? null,
            explanationQualityScore: data.explanationQualityScore ?? null,
          });
        }
      })
      .finally(() => setLoadingB(false));
  }, [sessionB]);

  // Score diff
  const scoreDiff =
    feedbackA?.overallScore != null && feedbackB?.overallScore != null
      ? feedbackB.overallScore - feedbackA.overallScore
      : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Compare Sessions</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Select two sessions to compare their scores, strengths, and weaknesses side by side.
      </p>

      {/* Session selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium mb-1 block">Session A</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={sessionA}
            onChange={(e) => setSessionA(e.target.value)}
            disabled={isLoadingSessions}
          >
            <option value="">Select a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === sessionB}>
                {getSessionLabel(s)} — {formatDate(s.createdAt)} (
                {s.overallScore?.toFixed(1)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Session B</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={sessionB}
            onChange={(e) => setSessionB(e.target.value)}
            disabled={isLoadingSessions}
          >
            <option value="">Select a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === sessionA}>
                {getSessionLabel(s)} — {formatDate(s.createdAt)} (
                {s.overallScore?.toFixed(1)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score diff banner */}
      {scoreDiff !== null && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center gap-2 py-4">
            <span className="text-sm text-muted-foreground">Score Change:</span>
            <Badge
              variant={scoreDiff > 0 ? "default" : scoreDiff < 0 ? "destructive" : "secondary"}
              className="text-sm"
            >
              {scoreDiff > 0 ? "+" : ""}
              {scoreDiff.toFixed(1)}
            </Badge>
            {scoreDiff > 0 && (
              <span className="text-sm text-green-600 dark:text-green-400">Improved</span>
            )}
            {scoreDiff < 0 && (
              <span className="text-sm text-red-600 dark:text-red-400">Regressed</span>
            )}
            {scoreDiff === 0 && (
              <span className="text-sm text-muted-foreground">No change</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Side-by-side feedback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeedbackColumn label="Session A" feedback={feedbackA} loading={loadingA} />
        <FeedbackColumn label="Session B" feedback={feedbackB} loading={loadingB} />
      </div>
    </div>
  );
}
