"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "./ScoreCard";
import { StrengthsWeaknesses } from "./StrengthsWeaknesses";
import { AnswerBreakdown } from "./AnswerBreakdown";

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
}

interface FeedbackDashboardProps {
  feedback: FeedbackData;
  sessionId: string;
}

export function FeedbackDashboard({
  feedback,
  sessionId,
}: FeedbackDashboardProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Interview Feedback</h1>
        <Link href="/interview/behavioral/setup">
          <Button variant="outline">Start New Interview</Button>
        </Link>
      </div>

      <ScoreCard score={feedback.overallScore} summary={feedback.summary} />

      <StrengthsWeaknesses
        strengths={feedback.strengths}
        weaknesses={feedback.weaknesses}
      />

      {feedback.answerAnalyses.length > 0 && (
        <AnswerBreakdown analyses={feedback.answerAnalyses} />
      )}

      <div className="flex gap-3 pt-4">
        <Link href="/interview/behavioral/setup">
          <Button>Start New Interview</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
