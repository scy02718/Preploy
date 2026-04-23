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
import { FileText, Upload, Loader2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { StructuredResumeView } from "./components/StructuredResumeView";
import { ImproveBulletDrawer } from "./components/ImproveBulletDrawer";
import type { StructuredResume } from "@/lib/resume-parser";

interface Resume {
  id: string;
  filename: string;
  content: string;
  structuredData?: StructuredResume | null;
  createdAt: string;
}

interface UndoEntry {
  oldBullet: string;
  newBullet: string;
}

interface DrawerState {
  open: boolean;
  bullet: string;
  roleTitle: string;
  roleCompany: string;
}

interface GeneratedQuestion {
  question: string;
  resume_reference: string;
  category: string;
}

export default function ResumePage() {
  const router = useRouter();
  const { setBehavioralPrefill, clearResumeReference } = usePrefillStore();
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

  // Delete state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Structured view: bullet rewrite drawer + session-local undo stack
  const [drawerState, setDrawerState] = useState<DrawerState>({
    open: false,
    bullet: "",
    roleTitle: "",
    roleCompany: "",
  });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [improvingBullet, setImprovingBullet] = useState<string | null>(null);

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

  const handleDeleteResume = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/resume/${id}`, { method: "DELETE" });
      if (res.status === 204) {
        const updatedResumes = resumes.filter((r) => r.id !== id);
        setResumes(updatedResumes);

        // If the deleted resume was selected, fall to the next one or null
        if (selectedResumeId === id) {
          setSelectedResumeId(updatedResumes.length > 0 ? updatedResumes[0].id : null);
        }

        // Clear any prefill that referenced this resume
        clearResumeReference(id);

        setPendingDeleteId(null);
        showMessage("success", "Resume deleted");
      } else {
        const err = await res.json().catch(() => ({}));
        showMessage("error", (err as { error?: string }).error || "Failed to delete resume");
      }
    } catch {
      showMessage("error", "Failed to delete resume");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImprove = (bullet: string, roleTitle: string, roleCompany: string) => {
    setImprovingBullet(bullet);
    setDrawerState({ open: true, bullet, roleTitle, roleCompany });
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerState((prev) => ({ ...prev, open }));
    if (!open) setImprovingBullet(null);
  };

  /**
   * Accept a bullet variant — PATCH the resume, update local state, push undo entry.
   */
  const handleAcceptVariant = async (oldBullet: string, newBullet: string) => {
    if (!selectedResumeId) return;
    const res = await fetch(`/api/resume/${selectedResumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldBullet, newBullet }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showMessage("error", (err as { error?: string }).error ?? "Failed to update bullet");
      return;
    }
    const updated = await res.json() as Resume;
    setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setUndoStack((prev) => [{ oldBullet, newBullet }, ...prev]);
    setImprovingBullet(null);
    showMessage("success", "Bullet updated. Use Undo to revert.");
  };

  /**
   * Undo the last rewrite — issues a reverse PATCH (new→old).
   * In-memory only; dies on navigation (per spec).
   */
  const handleUndo = async () => {
    if (undoStack.length === 0 || !selectedResumeId) return;
    const [{ oldBullet, newBullet }, ...rest] = undoStack;
    const res = await fetch(`/api/resume/${selectedResumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldBullet: newBullet, newBullet: oldBullet }),
    });
    if (!res.ok) {
      showMessage("error", "Failed to undo rewrite");
      return;
    }
    const updated = await res.json() as Resume;
    setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setUndoStack(rest);
    showMessage("success", "Rewrite undone.");
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
              {/* Resume list skeleton rows — mirror post-load layout with delete button */}
              <div className="space-y-2 pt-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                      <div className="space-y-1">
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                    {/* Delete button placeholder */}
                    <div className="h-7 w-7 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
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
              ? "border-[color:var(--chart-1)]/50 bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)]"
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
                    <div key={resume.id} className="space-y-0">
                      <div
                        className={`flex w-full items-center justify-between rounded-md border px-4 py-3 transition-colors ${
                          selectedResumeId === resume.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-accent"
                        } ${pendingDeleteId === resume.id ? "rounded-b-none border-b-0" : ""}`}
                      >
                        <button
                          onClick={() => setSelectedResumeId(resume.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{resume.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(resume.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedResumeId === resume.id && (
                            <Badge variant="secondary">Selected</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${resume.filename}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(
                                pendingDeleteId === resume.id ? null : resume.id
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline confirm strip */}
                      {pendingDeleteId === resume.id && (
                        <div className="flex items-center justify-between gap-3 rounded-b-md border border-t-0 border-destructive/50 bg-destructive/5 px-4 py-3">
                          <p className="text-sm text-destructive">
                            Delete this resume? This can&apos;t be undone.
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDeleteResume(resume.id)}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => setPendingDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
                  Upload a resume first — unlimited resume analysis, no quota cost.
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
                        company_name: company || undefined,
                        resume_id: selectedResumeId ?? undefined,
                      });
                      router.push("/interview/behavioral/setup");
                    }}
                  >
                    Use in Behavioral Setup
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Structured view — only when structuredData present */}
          {selectedResume?.structuredData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Structured View</CardTitle>
                  {undoStack.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUndo}
                      className="gap-1.5 text-sm"
                    >
                      <Undo2 className="h-4 w-4" aria-hidden="true" />
                      Undo last rewrite
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <StructuredResumeView
                  structuredData={selectedResume.structuredData}
                  resumeId={selectedResume.id}
                  onImprove={handleImprove}
                  improvingBullet={improvingBullet}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Improve bullet drawer — right sheet on desktop, bottom on mobile */}
      {selectedResume && (
        <ImproveBulletDrawer
          open={drawerState.open}
          onOpenChange={handleDrawerOpenChange}
          bullet={drawerState.bullet}
          roleTitle={drawerState.roleTitle}
          roleCompany={drawerState.roleCompany}
          resumeId={selectedResume.id}
          onAccept={handleAcceptVariant}
        />
      )}
    </div>
  );
}
