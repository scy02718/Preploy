"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInterviewStore } from "@/stores/interviewStore";
import { TemplateControls } from "./TemplateControls";
import { ResumeSelector } from "./ResumeSelector";
import { usePrefillStore } from "@/stores/prefillStore";
import type { BehavioralSessionConfig } from "@interview-assistant/shared";

interface CompanyQuestion {
  question: string;
  category: string;
  tip: string;
}

export function BehavioralSetupForm() {
  const router = useRouter();
  const { config, setConfig, setType, createSession } = useInterviewStore();
  const [questionInput, setQuestionInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company question generation state
  const [generatedQuestions, setGeneratedQuestions] = useState<CompanyQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { behavioralPrefill, clearPrefill } = usePrefillStore();

  useEffect(() => {
    setType("behavioral");
    // Apply prefill from other pages (resume questions, planner, etc.)
    if (behavioralPrefill) {
      if (behavioralPrefill.company_name) {
        setConfig({ company_name: behavioralPrefill.company_name });
      }
      if (behavioralPrefill.expected_questions?.length) {
        setConfig({ expected_questions: behavioralPrefill.expected_questions });
      }
      if (behavioralPrefill.resume_id) {
        setConfig({ resume_id: behavioralPrefill.resume_id });
      }
      clearPrefill();
    }
  }, [setType, behavioralPrefill, clearPrefill, setConfig]);

  const behavioralConfig = config as BehavioralSessionConfig;
  const interviewStyle = typeof behavioralConfig.interview_style === "number" ? behavioralConfig.interview_style : 0.5;
  const difficulty = typeof behavioralConfig.difficulty === "number" ? behavioralConfig.difficulty : 0.5;
  const questions = behavioralConfig.expected_questions ?? [];
  const companyName = behavioralConfig.company_name ?? "";

  const addQuestion = () => {
    const trimmed = questionInput.trim();
    if (!trimmed || questions.length >= 10) return;
    setConfig({ expected_questions: [...questions, trimmed] });
    setQuestionInput("");
  };

  const addGeneratedQuestion = (question: string) => {
    if (questions.length >= 10) return;
    if (questions.includes(question)) return;
    setConfig({ expected_questions: [...questions, question] });
  };

  const removeQuestion = (index: number) => {
    setConfig({
      expected_questions: questions.filter((_, i) => i !== index),
    });
  };

  const handleGenerateQuestions = async () => {
    if (!companyName.trim()) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate questions");
      }

      const data = await res.json();
      setGeneratedQuestions(data.questions);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
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
      <TemplateControls
        type="behavioral"
        currentConfig={behavioralConfig as unknown as Record<string, unknown>}
        onLoadTemplate={(config) => {
          // Replace the entire config with the template's config
          const templateConfig = config as unknown as BehavioralSessionConfig;
          setConfig(templateConfig);
        }}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column — Company Details + Expected Questions */}
        <div className="space-y-6">
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
                  value={behavioralConfig.company_name ?? ""}
                  onChange={(e) => setConfig({ company_name: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jd">Job Description (optional)</Label>
                <Textarea
                  id="jd"
                  placeholder="Paste the job description here... The AI interviewer will tailor questions to this role."
                  value={behavioralConfig.job_description ?? ""}
                  onChange={(e) => setConfig({ job_description: e.target.value })}
                  maxLength={5000}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  {(behavioralConfig.job_description ?? "").length}/5000 characters
                </p>
              </div>
            </CardContent>
          </Card>

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
                <ul className="max-h-48 overflow-y-auto space-y-2">
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
        </div>

        {/* Right column — Interview Settings + Resume + Company Questions */}
        <div className="space-y-6">
          <ResumeSelector
            selectedResumeId={behavioralConfig.resume_id ?? null}
            onSelect={(resumeId, resumeContent) => {
              setConfig({
                resume_id: resumeId ?? undefined,
                resume_text: resumeContent ?? undefined,
              });
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Interview Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Interview Style</Label>
                <Slider
                  value={[interviewStyle * 100]}
                  onValueChange={(val) => setConfig({ interview_style: val[0] / 100 })}
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
                  value={[difficulty * 100]}
                  onValueChange={(val) => setConfig({ difficulty: val[0] / 100 })}
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

          {/* Company-Specific Questions Widget */}
          <Card>
            <CardHeader>
              <CardTitle>Company-Specific Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate likely behavioral questions based on the company&apos;s
                known interview style and values.
              </p>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!companyName.trim() || isGenerating}
                onClick={handleGenerateQuestions}
              >
                {isGenerating
                  ? "Generating..."
                  : "Generate likely questions"}
              </Button>

              {!companyName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Enter a company name above to generate questions.
                </p>
              )}

              {generateError && (
                <p className="text-sm text-destructive">{generateError}</p>
              )}

              {generatedQuestions.length > 0 && (
                <ul className="max-h-64 overflow-y-auto space-y-3" data-testid="generated-questions">
                  {generatedQuestions.map((gq, i) => (
                    <li
                      key={i}
                      className="rounded-md border p-3 text-sm space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex-1">{gq.question}</span>
                        {questions.length < 10 && !questions.includes(gq.question) && (
                          <button
                            type="button"
                            onClick={() => addGeneratedQuestion(gq.question)}
                            className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                            aria-label={`Add question ${i + 1}`}
                          >
                            +
                          </button>
                        )}
                        {questions.includes(gq.question) && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Added
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {gq.category}
                        </span>
                        <span>{gq.tip}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
