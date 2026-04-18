"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getScoreColor } from "@/lib/utils";
import { StarPdfExportButton } from "@/components/star/StarPdfExportButton";
import { slugify } from "@/lib/slugify";
import { usePrefillStore } from "@/stores/prefillStore";
import {
  Star,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  X,
  Sparkles,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";

interface StarStory {
  id: string;
  title: string;
  role: string;
  expectedQuestions: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  createdAt: string;
  updatedAt: string;
}

interface StarAnalysis {
  id: string;
  storyId: string;
  scores: {
    persuasiveness_score: number;
    persuasiveness_justification: string;
    star_alignment_score: number;
    star_breakdown: {
      situation: number;
      task: number;
      action: number;
      result: number;
    };
    role_fit_score: number;
    role_fit_justification: string;
    question_fit_score: number;
    question_fit_justification: string;
  };
  suggestions: string[];
  model: string;
  createdAt: string;
}

interface StoryDetail {
  story: StarStory;
  analyses: StarAnalysis[];
}

const EMPTY_FORM = {
  title: "",
  role: "",
  expectedQuestions: [""],
  situation: "",
  task: "",
  action: "",
  result: "",
};

function StorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-xl font-bold ${getScoreColor(score / 10)}`}
      >
        {Math.round(score)}
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: StarAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const scores = analysis.scores;
  const detailsId = `analysis-details-${analysis.id}`;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {new Date(analysis.createdAt).toLocaleString()}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={expanded ? "Hide analysis details" : "Show analysis details"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <ScoreBadge score={scores.persuasiveness_score} label="Persuasive" />
        <ScoreBadge score={scores.star_alignment_score} label="STAR Align" />
        <ScoreBadge score={scores.role_fit_score} label="Role Fit" />
        <ScoreBadge score={scores.question_fit_score} label="Q Fit" />
      </div>

      {expanded && (
        <div id={detailsId} className="space-y-4 border-t pt-3">
          <div>
            <p className="text-sm font-medium mb-2">STAR Section Scores</p>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(scores.star_breakdown).map(([key, val]) => (
                <div key={key} className="text-center">
                  <span className={`text-sm font-semibold ${getScoreColor(val / 10)}`}>
                    {Math.round(val)}
                  </span>
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">PERSUASIVENESS</p>
              <p>{scores.persuasiveness_justification}</p>
            </div>
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">ROLE FIT</p>
              <p>{scores.role_fit_justification}</p>
            </div>
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">QUESTION FIT</p>
              <p>{scores.question_fit_justification}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Suggestions</p>
            <ul className="space-y-1">
              {analysis.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StarPrepPage() {
  const router = useRouter();
  const setBehavioralPrefill = usePrefillStore((s) => s.setBehavioralPrefill);
  const starPrepPrefill = usePrefillStore((s) => s.starPrepPrefill);
  const setStarPrepPrefill = usePrefillStore((s) => s.setStarPrepPrefill);
  const [plannerHint, setPlannerHint] = useState<string[] | null>(null);
  const [stories, setStories] = useState<StarStory[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportAllProgress, setExportAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [questionInput, setQuestionInput] = useState("");
  // Pending delete target — drives the styled confirmation dialog (replaces
  // the native `confirm()` which was inaccessible in embedded contexts).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Inline toast banner — replaces native `alert()` for analyze/export
  // failures. `useToast` isn't installed; a simple auto-dismissing banner
  // keeps the accessibility + styling benefits without adding a dependency.
  const [toast, setToast] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Consume starPrepPrefill from planner CTA on mount
  useEffect(() => {
    if (starPrepPrefill?.focus_topics && starPrepPrefill.focus_topics.length > 0) {
      setPlannerHint(starPrepPrefill.focus_topics);
      setStarPrepPrefill(null);
    }
  }, [starPrepPrefill, setStarPrepPrefill]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch("/api/star");
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories);
      }
    } catch {
      // Silent — non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  async function fetchDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/star/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDetail(data);
      }
    } catch {
      // Silent
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(false);
    setShowForm(true);
    setSelectedDetail(null);
  }

  function openEdit(story: StarStory) {
    setForm({
      title: story.title,
      role: story.role,
      expectedQuestions: story.expectedQuestions,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
    });
    setEditing(true);
    setShowForm(true);
  }

  function addQuestion() {
    const q = questionInput.trim();
    if (!q || form.expectedQuestions.length >= 3) return;
    setForm((f) => ({
      ...f,
      expectedQuestions: [...f.expectedQuestions.filter(Boolean), q],
    }));
    setQuestionInput("");
  }

  function removeQuestion(idx: number) {
    setForm((f) => ({
      ...f,
      expectedQuestions: f.expectedQuestions.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const questions = form.expectedQuestions.filter(Boolean);
    if (questions.length === 0) return;

    setSaving(true);
    try {
      const body = { ...form, expectedQuestions: questions };

      if (editing && selectedDetail) {
        const res = await fetch(`/api/star/${selectedDetail.story.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setStories((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
          setSelectedDetail((prev) =>
            prev ? { ...prev, story: updated } : null
          );
          setShowForm(false);
        }
      } else {
        const res = await fetch("/api/star", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setStories((prev) => [created, ...prev]);
          setShowForm(false);
          await fetchDetail(created.id);
        }
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(story: StarStory) {
    setPendingDelete({ id: story.id, title: story.title });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/star/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setToast({ tone: "error", text: "Delete failed. Please try again." });
        return;
      }
      setStories((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      if (selectedDetail?.story.id === pendingDelete.id) {
        setSelectedDetail(null);
      }
      setPendingDelete(null);
    } catch {
      setToast({ tone: "error", text: "Delete failed. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAnalyze(storyId: string) {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/star/${storyId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh detail to show the new analysis
        await fetchDetail(storyId);
      } else if (res.status === 429) {
        setToast({
          tone: "error",
          text: "Too many requests. Please wait before analyzing again.",
        });
      } else {
        setToast({ tone: "error", text: "Analysis failed. Please try again." });
      }
    } catch {
      setToast({ tone: "error", text: "Analysis failed. Please try again." });
    } finally {
      setAnalyzing(false);
    }
  }

  function handlePractice(story: StarStory) {
    // Pre-fill the behavioral setup form with this story's expected questions
    // and source_star_story_id via prefillStore. The setup form consumes the
    // store in its mount effect and applies the fields via setConfig.
    const questions = story.expectedQuestions.length
      ? story.expectedQuestions
      : [];
    setBehavioralPrefill({
      expected_questions: questions,
      source_star_story_id: story.id,
    });
    router.push("/interview/behavioral/setup");
  }

  async function handleExportAll() {
    if (exportingAll || stories.length === 0) return;
    setExportingAll(true);
    setExportAllProgress({ done: 0, total: stories.length });
    try {
      // Fetch each story's analyses in chunks of 5 for bounded concurrency
      const CHUNK = 5;
      const bundle: Array<{ story: StarStory; analyses: StarAnalysis[] }> = [];
      for (let i = 0; i < stories.length; i += CHUNK) {
        const chunk = stories.slice(i, i + CHUNK);
        const results = await Promise.all(
          chunk.map(async (s) => {
            try {
              const res = await fetch(`/api/star/${s.id}`);
              if (res.ok) {
                const data: StoryDetail = await res.json();
                return { story: s, analyses: data.analyses };
              }
            } catch {
              // Fall back to story-only if detail fetch fails
            }
            return { story: s, analyses: [] };
          })
        );
        bundle.push(...results);
        setExportAllProgress({ done: Math.min(i + CHUNK, stories.length), total: stories.length });
      }

      const { pdf } = await import("@react-pdf/renderer");
      const { StarStoriesBundlePDF } = await import("@/components/star/StarStoryPDF");

      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const blob = await pdf(
        <StarStoriesBundlePDF stories={bundle} date={date} />
      ).toBlob();

      const today = new Date().toISOString().slice(0, 10);
      const filename = `star-stories-${slugify(today)}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export all failed:", err);
    } finally {
      setExportingAll(false);
      setExportAllProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Inline toast — replaces `alert()` for analyze/delete/export failures.
          `aria-live="polite"` so screen readers pick it up without stealing focus. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-20 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-md transition-opacity motion-safe:duration-[var(--duration-base)] ${
            toast.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-foreground"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Destructive-action dialog — replaces the native `confirm()` which
          has no focus management and is blocked in some embedded contexts. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" and all its analyses will be permanently removed. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                "Delete story"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {plannerHint && plannerHint.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Suggested focus from your prep plan
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {plannerHint.map((topic, i) => (
                <span
                  key={i}
                  className="inline-block rounded-md bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPlannerHint(null)}
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 shrink-0"
            aria-label="Dismiss hint"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" aria-hidden="true" />
            STAR Story Prep
          </h1>
          <p className="text-muted-foreground">
            Craft and refine behavioral interview stories with AI feedback before your mock session.
          </p>
        </div>
        <div className="flex gap-2">
          {stories.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportAll}
              disabled={exportingAll}
              aria-label="Export all stories as PDF"
            >
              {exportingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {exportAllProgress
                    ? `Exporting ${exportAllProgress.done} of ${exportAllProgress.total}...`
                    : "Exporting..."}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export all
                </>
              )}
            </Button>
          )}
          <Button onClick={openCreate} disabled={showForm && !editing}>
            <Plus className="h-4 w-4 mr-2" />
            New Story
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Story list */}
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Stories</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <StorySkeleton />
              ) : stories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stories yet. Click &quot;New Story&quot; to get started — unlimited STAR practice, no quota cost.
                </p>
              ) : (
                <div className="space-y-2">
                  {stories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => {
                        setShowForm(false);
                        fetchDetail(story.id);
                      }}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedDetail?.story.id === story.id && !showForm
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{story.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {story.role}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated{" "}
                        {new Date(story.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — Form or Detail */}
        <div className="lg:col-span-2 space-y-4">
          {showForm ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {editing ? "Edit Story" : "New Story"}
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    aria-label={editing ? "Close edit form" : "Close new story form"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Story Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Led migration to microservices"
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Target Role</Label>
                      <Input
                        id="role"
                        placeholder="e.g., Senior Software Engineer"
                        value={form.role}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, role: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Expected Questions{" "}
                      <span className="text-muted-foreground text-xs">(1–3)</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a question and press Add"
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addQuestion();
                          }
                        }}
                        disabled={form.expectedQuestions.filter(Boolean).length >= 3}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addQuestion}
                        disabled={
                          !questionInput.trim() ||
                          form.expectedQuestions.filter(Boolean).length >= 3
                        }
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.expectedQuestions.filter(Boolean).map((q, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="flex items-center gap-1 max-w-[280px]"
                        >
                          <span className="truncate text-xs">{q}</span>
                          <button
                            type="button"
                            onClick={() => removeQuestion(i)}
                            className="shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {(["situation", "task", "action", "result"] as const).map(
                    (field) => (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={field} className="capitalize">
                          {field}
                        </Label>
                        <Textarea
                          id={field}
                          placeholder={
                            field === "situation"
                              ? "Describe the context and background..."
                              : field === "task"
                              ? "What was your responsibility or goal?"
                              : field === "action"
                              ? "What specific steps did you take?"
                              : "What was the outcome and measurable impact?"
                          }
                          value={form[field]}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [field]: e.target.value }))
                          }
                          rows={3}
                          required
                        />
                      </div>
                    )
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={
                        saving ||
                        form.expectedQuestions.filter(Boolean).length === 0
                      }
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : editing ? (
                        "Save Changes"
                      ) : (
                        "Create Story"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : detailLoading ? (
            <Card>
              <CardContent className="pt-6">
                <StorySkeleton />
              </CardContent>
            </Card>
          ) : selectedDetail ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{selectedDetail.story.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedDetail.story.role}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <StarPdfExportButton
                        story={selectedDetail.story}
                        analyses={selectedDetail.analyses}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(selectedDetail.story)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Delete story: ${selectedDetail.story.title}`}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => requestDelete(selectedDetail.story)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  {selectedDetail.story.expectedQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedDetail.story.expectedQuestions.map((q, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {(
                    [
                      ["situation", "Situation"],
                      ["task", "Task"],
                      ["action", "Action"],
                      ["result", "Result"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {label}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedDetail.story[field]}
                      </p>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleAnalyze(selectedDetail.story.id)}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Get AI Feedback
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handlePractice(selectedDetail.story)}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Practice this question
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedDetail.analyses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Analysis History ({selectedDetail.analyses.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedDetail.analyses.map((analysis) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Story</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a story from the list to view details and get AI feedback,
                  or create a new story to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
