"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrefillStore } from "@/stores/prefillStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Loader2, Sparkles, Trash2 } from "lucide-react";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
}

interface GeneratedQuestion {
  question: string;
  resume_reference: string;
  category: string;
}

export default function ResumePage() {
  const router = useRouter();
  const { setBehavioralPrefill } = usePrefillStore();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<"behavioral" | "technical">("behavioral");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  useEffect(() => {
    async function fetchResumes() {
      try {
        const res = await fetch("/api/resume");
        if (res.ok) {
          const data = await res.json();
          setResumes(data.resumes ?? []);
          if (data.resumes?.length > 0) {
            setSelectedResumeId(data.resumes[0].id);
          }
        }
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchResumes();
  }, []);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const resume = await res.json();
        setResumes((prev) => [resume, ...prev]);
        setSelectedResumeId(resume.id);
        showMessage("success", `Resume "${resume.filename}" uploaded successfully`);
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to upload resume");
      }
    } catch {
      showMessage("error", "Failed to upload resume");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const [pasteText, setPasteText] = useState("");
  const [isPasting, setIsPasting] = useState(false);

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setIsPasting(true);
    try {
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pasteText.trim() }),
      });
      if (res.ok) {
        const resume = await res.json();
        setResumes((prev) => [resume, ...prev]);
        setSelectedResumeId(resume.id);
        setPasteText("");
        showMessage("success", "Resume saved successfully");
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to save resume");
      }
    } catch {
      showMessage("error", "Failed to save resume");
    } finally {
      setIsPasting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedResumeId) return;
    setIsGenerating(true);
    setQuestions([]);

    try {
      const res = await fetch("/api/resume/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResumeId,
          question_type: questionType,
          ...(company.trim() && { company: company.trim() }),
          ...(role.trim() && { role: role.trim() }),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions ?? []);
        if (data.questions?.length === 0) {
          showMessage("error", "No questions were generated. Try again.");
        }
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to generate questions");
      }
    } catch {
      showMessage("error", "Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="h-32 w-full animate-pulse rounded bg-muted" />
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Resume Questions</h1>
      </div>
      <p className="mb-8 text-muted-foreground">
        Upload your resume and generate tailored interview questions based on your experience.
      </p>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column — Upload & Resume List */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
              >
                {isUploading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-2" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                )}
                <p className="text-sm font-medium">
                  {isUploading ? "Uploading..." : "Click to upload your resume"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, TXT, or MD file, max 5MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Or Paste Your Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Paste your resume text here... (Copy from your resume PDF or document)"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                maxLength={50000}
              />
              <Button
                onClick={handlePaste}
                disabled={isPasting || !pasteText.trim()}
                className="w-full"
              >
                {isPasting ? "Saving..." : "Save Resume"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Resumes</CardTitle>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resumes uploaded yet. Upload one to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {resumes.map((resume) => (
                    <button
                      key={resume.id}
                      onClick={() => setSelectedResumeId(resume.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${
                        selectedResumeId === resume.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{resume.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(resume.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {selectedResumeId === resume.id && (
                        <Badge variant="secondary" className="shrink-0">Selected</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resume preview */}
          {selectedResume && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview: {selectedResume.filename}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground bg-muted/50 rounded-md p-4">
                  {selectedResume.content.slice(0, 2000)}
                  {selectedResume.content.length > 2000 && "\n..."}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — Generate Questions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={questionType}
                  onValueChange={(v) => setQuestionType(v as "behavioral" | "technical")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company (optional)</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role (optional)</Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  maxLength={200}
                />
              </div>

              <Button
                onClick={handleGenerateQuestions}
                disabled={!selectedResumeId || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Questions
                  </>
                )}
              </Button>

              {!selectedResumeId && resumes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Upload a resume first to generate questions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generated Questions */}
          {isGenerating && (
            <Card>
              <CardContent className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {questions.length > 0 && !isGenerating && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Generated Questions ({questions.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuestions([])}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto space-y-4">
                  {questions.map((q, i) => (
                    <div key={i} className="rounded-md border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.question}
                        </p>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {q.category}
                        </Badge>
                      </div>
                      {q.resume_reference && (
                        <p className="text-xs text-muted-foreground">
                          Based on: {q.resume_reference}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {questionType === "behavioral" && (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => {
                      setBehavioralPrefill({
                        expected_questions: questions.map((q) => q.question),
                        company: company || undefined,
                        resume_id: selectedResumeId ?? undefined,
                      } as Record<string, unknown> as Parameters<typeof setBehavioralPrefill>[0]);
                      router.push("/interview/behavioral/setup");
                    }}
                  >
                    Use in Behavioral Setup
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
