"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInterviewStore } from "@/stores/interviewStore";

export function BehavioralSetupForm() {
  const router = useRouter();
  const { config, setConfig, createSession } = useInterviewStore();
  const [questionInput, setQuestionInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = config.expected_questions ?? [];

  const addQuestion = () => {
    const trimmed = questionInput.trim();
    if (!trimmed || questions.length >= 10) return;
    setConfig({ expected_questions: [...questions, trimmed] });
    setQuestionInput("");
  };

  const removeQuestion = (index: number) => {
    setConfig({
      expected_questions: questions.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const sessionId = await createSession();
    setIsSubmitting(false);

    if (sessionId) {
      router.push("/interview/behavioral/session");
    } else {
      setError(
        useInterviewStore.getState().error || "Failed to create session"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company & Job Description */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company Name (optional)</Label>
            <Input
              id="company"
              placeholder="e.g., Google, Meta, Startup XYZ"
              value={config.company_name ?? ""}
              onChange={(e) => setConfig({ company_name: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jd">Job Description (optional)</Label>
            <Textarea
              id="jd"
              placeholder="Paste the job description here... The AI interviewer will tailor questions to this role."
              value={config.job_description ?? ""}
              onChange={(e) => setConfig({ job_description: e.target.value })}
              maxLength={5000}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {(config.job_description ?? "").length}/5000 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Expected Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add questions you expect to be asked. The AI may use some of these
            and also add its own.
          </p>

          {questions.length > 0 && (
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex-1">{q}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove question ${i + 1}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          {questions.length < 10 && (
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Tell me about a time you led a team..."
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuestion();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addQuestion}>
                Add
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {questions.length}/10 questions
          </p>
        </CardContent>
      </Card>

      {/* Interview Style & Difficulty */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Interview Style</Label>
            <Slider
              value={[config.interview_style * 100]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val[0] : val;
                setConfig({ interview_style: v / 100 });
              }}
              min={0}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Strict & Formal</span>
              <span>Casual & Conversational</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Difficulty</Label>
            <Slider
              value={[config.difficulty * 100]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val[0] : val;
                setConfig({ difficulty: v / 100 });
              }}
              min={0}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Entry-level</span>
              <span>Senior / Staff</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating Session..." : "Start Interview"}
      </Button>
    </form>
  );
}
